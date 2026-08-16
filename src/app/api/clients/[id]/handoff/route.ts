import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/rbac/permissions";

const schema = z.object({
  action: z.enum(["READY_FOR_PROCESSING", "RETURN_TO_SIMON", "OWNER_REVIEW"]),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!hasPermission(user.role, "MANAGE_OPERATIONS")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const simon = await prisma.user.findFirst({ where: { role: "CUSTOMER_SERVICE", isActive: true } });
    const jona = await prisma.user.findFirst({ where: { role: "FILE_PREPARER", isActive: true } });

    let stage = client.stage;
    let nextAction = client.nextAction;
    let nextActionOwner = client.nextActionOwner;
    let eventTitle = "";
    let eventDescription = "";

    if (parsed.data.action === "READY_FOR_PROCESSING") {
      const missing = await prisma.onboardingItem.count({
        where: { clientId: client.id, status: "MISSING" },
      });
      if (missing > 0) {
        return NextResponse.json(
          { error: `${missing} onboarding item(s) still missing` },
          { status: 400 },
        );
      }
      stage = "READY_FOR_PROCESSING";
      nextActionOwner = "JONA";
      nextAction = "Review file and prepare next dispute round";
      eventTitle = "Ready for processing";
      eventDescription = `Handed to ${jona ? jona.firstName : "Jona"} by ${user.firstName}`;

      if (jona) {
        await prisma.task.create({
          data: {
            clientId: client.id,
            title: `Process ${client.firstName} ${client.lastName}`,
            status: "OPEN",
            priority: "HIGH",
            category: "file preparation",
            assigneeId: jona.id,
            createdById: user.id,
            dueAt: new Date(Date.now() + 2 * 86400000),
          },
        });
        await prisma.clientAssignment.upsert({
          where: { clientId_staffId: { clientId: client.id, staffId: jona.id } },
          create: { clientId: client.id, staffId: jona.id, roleLabel: "File Preparation", isPrimary: true },
          update: { isPrimary: true, roleLabel: "File Preparation" },
        });
      }
    } else if (parsed.data.action === "RETURN_TO_SIMON") {
      stage = "CLIENT_ACTION_REQUIRED";
      nextActionOwner = "SIMON";
      nextAction = "Client action required — follow up and collect updates";
      eventTitle = "Returned to Simon";
      eventDescription = `Returned by ${user.firstName}`;
      if (simon) {
        await prisma.task.create({
          data: {
            clientId: client.id,
            title: `Follow up ${client.firstName} ${client.lastName}`,
            status: "OPEN",
            priority: "HIGH",
            category: "client follow-up",
            assigneeId: simon.id,
            createdById: user.id,
          },
        });
      }
    } else {
      stage = "GOAL_REVIEW";
      nextActionOwner = "CHARLES";
      nextAction = "Owner review required";
      eventTitle = "Owner review queued";
      eventDescription = `Flagged by ${user.firstName}`;
    }

    await prisma.client.update({
      where: { id: client.id },
      data: { stage, nextAction, nextActionOwner, lastInteractionAt: new Date() },
    });

    await prisma.clientTimelineEvent.create({
      data: {
        clientId: client.id,
        actorId: user.id,
        eventType: parsed.data.action,
        title: eventTitle,
        description: eventDescription,
      },
    });

    return NextResponse.json({ ok: true, stage, nextAction, nextActionOwner });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
