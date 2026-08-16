import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { refundTransaction } from "@/lib/payments/service";

const schema = z.object({
  transactionId: z.string(),
  amountCents: z.number().int().positive().optional(),
  reason: z.string().optional(),
  idempotencyKey: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "ISSUE_REFUNDS");
    const body = schema.parse(await req.json());
    const result = await refundTransaction({
      ...body,
      actorId: user.id,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Refund failed";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
