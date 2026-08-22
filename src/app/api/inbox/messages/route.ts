import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { postMessage } from "@/lib/communications/service";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({
  conversationId: z.string().min(1),
  body: z.string().min(1).max(8000),
  isInternal: z.boolean(),
  channel: z.enum(["INTERNAL", "SMS", "EMAIL"]).optional(),
  subject: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const conv = await prisma.conversation.findUnique({ where: { id: parsed.data.conversationId } });
    if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    if (!parsed.data.isInternal && conv.kind !== "CLIENT") {
      return NextResponse.json(
        { error: "Client messages can only be sent from a client conversation" },
        { status: 400 },
      );
    }

    const mentionMatches = [...parsed.data.body.matchAll(/@(\w+)/g)].map((m) => m[1].toLowerCase());
    const allStaff = await prisma.user.findMany({ where: { role: { not: "CLIENT" } } });
    const mentionUserIds = allStaff
      .filter((u) => mentionMatches.includes(u.firstName.toLowerCase()))
      .map((u) => u.id);

    const result = await postMessage({
      conversationId: parsed.data.conversationId,
      senderId: user.id,
      body: parsed.data.body,
      isInternal: parsed.data.isInternal,
      channel: parsed.data.isInternal
        ? "INTERNAL"
        : parsed.data.channel === "EMAIL"
          ? "EMAIL"
          : "SMS",
      subject: parsed.data.subject,
      mentionUserIds,
    });

    if (conv.clientId && parsed.data.isInternal) {
      await prisma.clientTimelineEvent.create({
        data: {
          clientId: conv.clientId,
          actorId: user.id,
          eventType: "INTERNAL_NOTE",
          title: "Internal note added",
          description: parsed.data.body.slice(0, 180),
        },
      });
    }

    if (!parsed.data.isInternal && result.deliveryStatus === "FAILED") {
      return NextResponse.json(
        {
          error:
            (result.metadata?.actionRequired as string) ||
            "Outbound send failed — ACTION_REQUIRED",
          message: result.message,
          deliveryStatus: result.deliveryStatus,
          actionRequired: true,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      message: result.message,
      deliveryStatus: result.deliveryStatus,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
