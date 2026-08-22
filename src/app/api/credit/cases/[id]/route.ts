import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { advanceCase, DisputeCaseError, getCaseById, updatePacketNotes } from "@/lib/disputes/cases";

const patchSchema = z.object({
  action: z.enum(["advance", "packet"]),
  packetNotes: z.string().optional(),
  externalRef: z.string().optional(),
  outcome: z.string().optional(),
  outcomeNote: z.string().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "VIEW_CREDIT_DOCS");
    const { id } = await ctx.params;
    const disputeCase = await getCaseById(id);
    return NextResponse.json({ case: disputeCase });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      e instanceof DisputeCaseError ? e.status : msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_CREDIT");
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const disputeCase =
      body.action === "packet"
        ? await updatePacketNotes({ caseId: id, packetNotes: body.packetNotes || "", actorId: user.id })
        : await advanceCase({
            caseId: id,
            actorId: user.id,
            externalRef: body.externalRef,
            outcome: body.outcome,
            outcomeNote: body.outcomeNote,
          });
    return NextResponse.json({ case: disputeCase });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      e instanceof DisputeCaseError ? e.status : msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
