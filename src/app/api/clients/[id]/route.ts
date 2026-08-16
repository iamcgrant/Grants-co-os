import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { assertPermission, canAccessFinancialData } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { getClientTimeline } from "@/lib/clients/timeline";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "VIEW_CLIENT");
    const { id } = await ctx.params;

    const client = await prisma.client.findFirst({
      where: {
        OR: [{ id }, { grantsClientId: id }],
      },
      include: {
        identifiers: true,
        addresses: true,
        clientServices: {
          include: {
            service: true,
            billingPolicy: true,
            milestones: true,
          },
        },
        documents: true,
        creditConnections: {
          select: {
            id: true,
            provider: true,
            status: true,
            externalId: true,
            lastSyncedAt: true,
            needsReauth: true,
            // credentialRef intentionally omitted from API
          },
        },
        creditScores: { orderBy: { capturedAt: "desc" }, take: 30 },
        assignments: {
          include: {
            staff: { select: { firstName: true, lastName: true, role: true } },
          },
        },
      },
    });

    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const timeline = await getClientTimeline(client.id);

    let financials = null;
    if (canAccessFinancialData(user.role)) {
      const [invoices, transactions, refunds, disputes, methods] = await Promise.all([
        prisma.invoice.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" } }),
        prisma.paymentTransaction.findMany({
          where: { clientId: client.id },
          orderBy: { createdAt: "desc" },
        }),
        prisma.refund.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" } }),
        prisma.paymentDispute.findMany({ where: { clientId: client.id } }),
        prisma.paymentMethod.findMany({
          where: { clientId: client.id },
          select: {
            id: true,
            type: true,
            brand: true,
            last4: true,
            expMonth: true,
            expYear: true,
            isDefault: true,
            provider: true,
          },
        }),
      ]);
      financials = { invoices, transactions, refunds, disputes, methods };
    }

    return NextResponse.json({ client, timeline, financials });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
