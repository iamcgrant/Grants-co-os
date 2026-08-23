import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { createMortgagePaymentRequest } from "@/lib/los/review-payment";
import { readJson, readParams, toHttpResponse } from "../../../_handler";

/** POST /api/los/applications/:id/payment-request — generate payment request after review */
export async function POST(
  request: Request,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_PAYMENTS");
    const { id } = await readParams(ctx);
    const body = await readJson(request);
    const amountCents =
      typeof body.amountCents === "number" ? body.amountCents : undefined;
    const result = await createMortgagePaymentRequest({
      applicationId: id,
      actorUserId: user.id,
      amountCents,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return toHttpResponse(err);
  }
}
