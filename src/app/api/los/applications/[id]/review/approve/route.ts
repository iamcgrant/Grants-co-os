import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { approveInternalReview } from "@/lib/los/review-payment";
import { readParams, toHttpResponse } from "../../_handler";

/** POST /api/los/applications/:id/review/approve — staff queues file for review (Option B) */
export async function POST(
  _request: Request,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_OPERATIONS");
    const { id } = await readParams(ctx);
    const result = await approveInternalReview({
      applicationId: id,
      actorUserId: user.id,
    });
    return NextResponse.json(result);
  } catch (err) {
    return toHttpResponse(err);
  }
}
