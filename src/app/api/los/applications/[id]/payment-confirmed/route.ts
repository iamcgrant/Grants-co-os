import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { confirmMortgageServicePayment } from "@/lib/los/review-payment";
import { readJson, readParams, toHttpResponse } from "../../../_handler";

const schema = z.object({
  transactionId: z.string().min(1),
  amountCents: z.number().int().positive(),
  paymentRequestPublicId: z.string().optional(),
});

/** POST /api/los/applications/:id/payment-confirmed — record payment + unlock workflow */
export async function POST(
  request: Request,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_PAYMENTS");
    const { id } = await readParams(ctx);
    const body = schema.parse(await readJson(request));
    const result = await confirmMortgageServicePayment({
      applicationId: id,
      transactionId: body.transactionId,
      amountCents: body.amountCents,
      actorUserId: user.id,
      paymentRequestPublicId: body.paymentRequestPublicId,
    });
    return NextResponse.json(result);
  } catch (err) {
    return toHttpResponse(err);
  }
}
