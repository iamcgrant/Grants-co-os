import { NextResponse } from "next/server";
import {
  applyGrantsPayInboundPayment,
  grantsPayInboundContract,
  grantsPayInboundSecretConfigured,
  verifyGrantsPayInboundSecret,
} from "@/lib/payments/inbound-webhook";

/** Documented contract for Zapier / GHL — never exposes secrets. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    ...grantsPayInboundContract(),
    secretConfigured: grantsPayInboundSecretConfigured(),
  });
}

export async function POST(req: Request) {
  if (!grantsPayInboundSecretConfigured()) {
    return NextResponse.json(
      {
        error:
          "ACTION_REQUIRED: set GRANTS_PAY_INBOUND_WEBHOOK_SECRET. Fanbasis has no API Keys page — do not invent COMMAS_API_KEY.",
      },
      { status: 503 },
    );
  }
  if (!verifyGrantsPayInboundSecret(req.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody = await req.text();
    const result = await applyGrantsPayInboundPayment(rawBody);
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook error" },
      { status: 400 },
    );
  }
}
