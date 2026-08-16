import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { listPendingApprovals, decideApproval } from "@/lib/agent-hub";

export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_STAFF");
    const approvals = await listPendingApprovals();
    return NextResponse.json({ approvals });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

const decideSchema = z.object({
  approvalId: z.string().min(1),
  decision: z.enum(["APPROVED", "DENIED"]),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_STAFF");
    const body = decideSchema.parse(await req.json());
    const approval = await decideApproval({
      approvalId: body.approvalId,
      decision: body.decision,
      decidedById: user.id,
      note: body.note,
    });
    return NextResponse.json({ approval });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
