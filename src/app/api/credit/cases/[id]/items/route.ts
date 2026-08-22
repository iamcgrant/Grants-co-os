import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { addCaseItem, DisputeCaseError } from "@/lib/disputes/cases";

const schema = z.object({
  label: z.string().min(1),
  bureau: z.string().optional(),
  accountRef: z.string().optional(),
  reason: z.string().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_CREDIT");
    const { id } = await ctx.params;
    const body = schema.parse(await req.json());
    const disputeCase = await addCaseItem({ ...body, caseId: id, actorId: user.id });
    return NextResponse.json({ case: disputeCase });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      e instanceof DisputeCaseError ? e.status : msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
