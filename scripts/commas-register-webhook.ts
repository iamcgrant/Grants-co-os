#!/usr/bin/env npx tsx
/**
 * Register / refresh Commas webhook subscription for Grants Pay.
 * Requires COMMAS_API_KEY. Prints secret_key ONCE when created — store in secrets, never commit.
 *
 * Usage:
 *   COMMAS_API_KEY=... NEXT_PUBLIC_APP_URL=https://os.grantandconsultants.com npx tsx scripts/commas-register-webhook.ts
 */
import "dotenv/config";
import { commasBaseUrl, isCommasConfigured, resolveCommasEnvironment } from "../src/lib/payments/commas-config";

async function main() {
  if (!isCommasConfigured()) {
    console.error("ACTION_REQUIRED: set COMMAS_API_KEY (sandbox first).");
    process.exit(2);
  }

  const apiKey = process.env.COMMAS_API_KEY!.trim();
  const base = commasBaseUrl(resolveCommasEnvironment());
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (!appUrl || appUrl.includes("localhost")) {
    console.error(
      "ACTION_REQUIRED: set NEXT_PUBLIC_APP_URL to the public HTTPS origin (e.g. https://os.grantandconsultants.com).",
    );
    process.exit(2);
  }

  const webhookUrl = `${appUrl}/api/webhooks/payments`;
  const eventTypes = [
    "payment.succeeded",
    "payment.failed",
    "refund.succeeded",
    "subscription.canceled",
  ];

  console.log(`Environment: ${resolveCommasEnvironment()}`);
  console.log(`Webhook URL: ${webhookUrl}`);
  console.log(`Base: ${base}`);

  const listRes = await fetch(`${base}/public-api/webhook-subscriptions`, {
    headers: { "x-api-key": apiKey, Accept: "application/json" },
  });
  const listJson = (await listRes.json().catch(() => ({}))) as {
    data?: Array<{ id?: string | number; webhook_url?: string }>;
  };
  if (!listRes.ok) {
    console.error("Failed to list webhook subscriptions", listRes.status, listJson);
    process.exit(1);
  }

  const existing = (listJson.data || []).find((w) => w.webhook_url === webhookUrl);
  if (existing) {
    console.log(`Existing subscription found id=${existing.id} — not recreating (secret already issued).`);
    console.log("If you need a new secret_key, delete the subscription in the Commas dashboard and re-run.");
    process.exit(0);
  }

  const createRes = await fetch(`${base}/public-api/webhook-subscriptions`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ webhook_url: webhookUrl, event_types: eventTypes }),
  });
  const created = (await createRes.json().catch(() => ({}))) as {
    status?: string;
    message?: string;
    data?: { id?: string | number; secret_key?: string; webhook_url?: string };
  };

  if (!createRes.ok || created.status === "error") {
    console.error("Create failed", createRes.status, created);
    process.exit(1);
  }

  const secret = created.data?.secret_key;
  console.log(`Created webhook subscription id=${created.data?.id}`);
  if (secret) {
    console.log("STORE THIS SECRET NOW (shown once by Commas):");
    console.log(`COMMAS_WEBHOOK_SECRET=${secret}`);
    console.log("Add it as a Cursor / host environment secret. Do not commit.");
  } else {
    console.log("No secret_key in response — check Commas dashboard.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
