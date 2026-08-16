import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { completeMilestone, createInvoiceFromMilestone } from "@/lib/billing/engine";

const schema = z.object({
  supportingDocumentId: z.string().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_OPERATIONS");
    const { id } = await ctx.params;
    const body = schema.parse(await req.json().catch(() => ({})));

    const milestone = await completeMilestone({
      milestoneId: id,
      completedByUserId: user.id,
      supportingDocumentId: body.supportingDocumentId,
    });

    return NextResponse.json({ milestone });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
