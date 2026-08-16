import { NextResponse } from "next/server";
import { processWebhook } from "@/lib/payments/service";

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
