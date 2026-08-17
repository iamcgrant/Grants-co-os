import { NextResponse } from "next/server";
import { processWebhook } from "@/lib/payments/service";
import { commasPublicStatus } from "@/lib/payments/commas-config";

/** Liveness for ops / smoke tests — never exposes secrets. */
export async function GET() {
  const commas = commasPublicStatus();
  return NextResponse.json({
    ok: true,
    endpoint: "/api/webhooks/payments",
    accepts: "POST",
    paymentProvider: process.env.PAYMENT_PROVIDER || "mock",
    commasConfigured: commas.configured,
    commasEnvironment: commas.environment,
    webhookSecretConfigured: Boolean(process.env.COMMAS_WEBHOOK_SECRET?.trim()),
  });
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const headers: Record<string, string | string[] | undefined> = {};
    req.headers.forEach((v, k) => {
      headers[k] = v;
    });

    const result = await processWebhook(rawBody, headers);
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
