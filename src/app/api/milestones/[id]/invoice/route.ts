import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { createInvoiceFromMilestone } from "@/lib/billing/engine";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_PAYMENTS");
    const { id } = await ctx.params;
    const invoice = await createInvoiceFromMilestone({
      milestoneId: id,
      actorId: user.id,
    });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
