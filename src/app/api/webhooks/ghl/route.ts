import { NextResponse } from "next/server";
import { ingestVerifiedWebhook, webhookSecretConfigured } from "@/lib/webhooks/ingest";

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/webhooks/ghl",
    accepts: "POST",
    secretConfigured: webhookSecretConfigured("ghl"),
    note: "Inbound only. Linked masters. Never creates Grants clients.",
  });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers: Record<string, string | string[] | undefined> = {};
  req.headers.forEach((v, k) => {
    headers[k] = v;
  });

  const result = await ingestVerifiedWebhook({ provider: "ghl", rawBody, headers });
  if (!result.accepted) {
    return NextResponse.json({ error: result.reason }, { status: 401 });
  }
  return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
}
