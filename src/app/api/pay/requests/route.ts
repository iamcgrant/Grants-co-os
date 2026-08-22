import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { createPaymentRequest } from "@/lib/payments/payment-requests";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "MANAGE_PAYMENTS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      clientId?: string;
      amountCents?: number;
      serviceName?: string;
      description?: string;
      dueAt?: string;
      notes?: string;
      allowPartial?: boolean;
      recurring?: boolean;
      recurringDays?: number;
      sendEmail?: boolean;
      sendSms?: boolean;
      commasCheckoutUrl?: string;
      commasProductId?: string;
    };

    if (!body.clientId || !body.amountCents) {
      return NextResponse.json({ error: "clientId and amountCents required" }, { status: 400 });
    }

    const result = await createPaymentRequest({
      clientId: body.clientId,
      amountCents: body.amountCents,
      serviceName: body.serviceName,
      description: body.description,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      notes: body.notes,
      allowPartial: body.allowPartial,
      recurring: body.recurring,
      recurringDays: body.recurringDays,
      actorId: user.id,
      sendEmail: body.sendEmail,
      sendSms: body.sendSms,
      commasCheckoutUrl: body.commasCheckoutUrl,
      commasProductId: body.commasProductId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create payment request" },
      { status: 400 },
    );
  }
}
