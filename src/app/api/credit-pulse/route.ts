import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { runFridayCreditPulse } from "@/lib/credit/pulse";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_CREDIT");

    const clients = await prisma.client.findMany({
      where: { creditConnections: { some: { status: "CONNECTED" } } },
      include: {
        creditScores: { orderBy: { capturedAt: "desc" }, take: 9 },
        creditConnections: {
          select: {
            provider: true,
            status: true,
            needsReauth: true,
            lastSyncedAt: true,
          },
        },
      },
      take: 50,
    });

    return NextResponse.json({ clients });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

const pulseSchema = z.object({
  clientId: z.string(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_CREDIT");
    const body = pulseSchema.parse(await req.json());
    const result = await runFridayCreditPulse(body.clientId);
    return NextResponse.json({ result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
