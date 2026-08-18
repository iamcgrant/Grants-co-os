#!/usr/bin/env npx tsx
/**
 * Production launch readiness — fixed 11 gates.
 * Exit 0 only on 11/11. Never prints secret values.
 */
import "dotenv/config";

type Gate = { id: string; ok: boolean; detail: string };

const gates: Gate[] = [];

function gate(id: string, ok: boolean, detail: string) {
  gates.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function present(name: string): boolean {
  const v = process.env[name];
  return Boolean(v && v.trim().length > 0);
}

function isPostgres(url: string | undefined): boolean {
  if (!url) return false;
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

async function probeGhlOutbound(): Promise<{ ok: boolean; detail: string }> {
  const key = process.env.GHL_API_KEY?.trim();
  const loc = process.env.GHL_LOCATION_ID?.trim();
  if (!key || !loc) return { ok: false, detail: "GHL_API_KEY / GHL_LOCATION_ID missing" };

  const res = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ type: "SMS", contactId: "launch-readiness-probe", message: "probe" }),
  });
  const body = await res.text();
  if (res.status === 401 || res.status === 403) {
    return { ok: false, detail: `PIT missing conversations/message.write (HTTP ${res.status})` };
  }
  if (res.status === 404 || res.status === 422 || res.status === 400) {
    return { ok: true, detail: `Write scope appears present (HTTP ${res.status})` };
  }
  return { ok: res.ok, detail: `HTTP ${res.status}: ${body.slice(0, 120)}` };
}

async function probePublicOrigin(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/health`, {
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
    return {
      ok: res.ok && json.ok === true,
      detail: `HTTP ${res.status} ok=${String(json.ok)}`,
    };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "fetch failed" };
  }
}

async function main() {
  console.log("=== Grants & Co OS — Launch Readiness (11 gates) ===\n");

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const paymentProvider = (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
  const db = process.env.DATABASE_URL || "";

  gate("1_commas_api_key", present("COMMAS_API_KEY"), present("COMMAS_API_KEY") ? "set" : "ACTION_REQUIRED: Commas dashboard → COMMAS_API_KEY");
  gate(
    "2_commas_webhook_secret",
    present("COMMAS_WEBHOOK_SECRET"),
    present("COMMAS_WEBHOOK_SECRET") ? "set" : "ACTION_REQUIRED: run commas:register-webhook after public URL",
  );
  gate(
    "3_payment_provider_commas",
    paymentProvider === "commas",
    `PAYMENT_PROVIDER=${paymentProvider}`,
  );
  gate(
    "4_public_app_url",
    Boolean(appUrl) && !appUrl.includes("localhost") && appUrl.startsWith("https://"),
    appUrl || "NEXT_PUBLIC_APP_URL unset",
  );
  gate(
    "5_production_postgres",
    isPostgres(db),
    isPostgres(db) ? "postgresql configured" : "ACTION_REQUIRED: Neon/Supabase DATABASE_URL",
  );
  gate("6_auth_secret", present("AUTH_SECRET"), present("AUTH_SECRET") ? "set" : "missing AUTH_SECRET");
  gate(
    "7_gc_cron_secret",
    present("GC_CRON_SECRET") || present("CRON_SECRET"),
    present("GC_CRON_SECRET") || present("CRON_SECRET") ? "set" : "missing GC_CRON_SECRET",
  );
  // BUILDX owns Vercel CLI/token/Neon/domain. Agent sessions set GC_VERCEL_EXTERNAL=1.
  const vercelExternal =
    process.env.GC_VERCEL_EXTERNAL === "1" ||
    process.env.GC_DEPLOY_OWNER?.toLowerCase() === "buildx";
  gate(
    "8_vercel_deploy",
    present("VERCEL_TOKEN") || vercelExternal,
    present("VERCEL_TOKEN")
      ? "VERCEL_TOKEN set"
      : vercelExternal
        ? "BUILDX/external Vercel ownership (GC_VERCEL_EXTERNAL=1)"
        : "ACTION_REQUIRED: BUILDX sets GC_VERCEL_EXTERNAL=1 on Vercel, or provide VERCEL_TOKEN",
  );
  gate("9_ghl_inbound", present("GHL_API_KEY") && present("GHL_LOCATION_ID"), present("GHL_API_KEY") && present("GHL_LOCATION_ID") ? "set" : "missing GHL credentials");

  const outbound = await probeGhlOutbound();
  gate("10_ghl_outbound_write", outbound.ok, outbound.detail);

  if (appUrl && appUrl.startsWith("https://") && !appUrl.includes("localhost")) {
    const pub = await probePublicOrigin(appUrl);
    gate("11_public_health", pub.ok, pub.detail);
  } else {
    gate("11_public_health", false, "skipped — no public HTTPS origin yet");
  }

  const passed = gates.filter((g) => g.ok).length;
  console.log(`\n--- ${passed}/11 PASS ---`);

  if (passed < 11) {
    console.log("\nNOT PRODUCTION-COMPLETE");
    for (const g of gates.filter((x) => !x.ok)) {
      console.log(`  - ${g.id}: ${g.detail}`);
    }
    process.exit(3);
  }

  console.log("\n11/11 PASS — production readiness gate cleared.");
  console.log("Next: npm run e2e:production && npm run smoke:production");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
