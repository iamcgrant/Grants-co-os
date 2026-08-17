#!/usr/bin/env npx tsx
/**
 * FINAL PRODUCTION LAUNCH readiness gate.
 * Never declares PRODUCTION COMPLETE while mock / localhost / missing secrets remain.
 * Does not print secret values.
 */
import "dotenv/config";

type Gate = { id: string; ok: boolean; detail: string; blocker?: boolean };

const gates: Gate[] = [];

function gate(id: string, ok: boolean, detail: string, blocker = false) {
  gates.push({ id, ok, detail, blocker });
  const mark = ok ? "OK  " : blocker ? "BLOCK" : "WARN";
  console.log(`${mark}  ${id} — ${detail}`);
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
    return {
      ok: false,
      detail: `PIT missing conversations/message.write (HTTP ${res.status})`,
    };
  }
  // 404/422 on dummy contact means the write scope is present
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
  console.log("=== Grants & Co OS — Launch Readiness ===\n");

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const paymentProvider = (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
  const db = process.env.DATABASE_URL || "";

  gate(
    "commas_api_key",
    present("COMMAS_API_KEY"),
    present("COMMAS_API_KEY") ? "set" : "missing — add Cursor/host secret",
    true,
  );
  gate(
    "commas_webhook_secret",
    present("COMMAS_WEBHOOK_SECRET"),
    present("COMMAS_WEBHOOK_SECRET") ? "set" : "missing — register webhook then store secret",
    true,
  );
  gate(
    "payment_provider_commas",
    paymentProvider === "commas",
    `PAYMENT_PROVIDER=${paymentProvider} (need commas)`,
    true,
  );
  gate(
    "public_app_url",
    Boolean(appUrl) && !appUrl.includes("localhost") && appUrl.startsWith("https://"),
    appUrl || "NEXT_PUBLIC_APP_URL unset",
    true,
  );
  gate(
    "production_postgres",
    isPostgres(db),
    isPostgres(db) ? "postgresql configured" : `DATABASE_URL is not Postgres (${db.slice(0, 24)}…)`,
    true,
  );
  gate(
    "auth_secret",
    present("AUTH_SECRET"),
    present("AUTH_SECRET") ? "set" : "missing",
    true,
  );
  gate(
    "vercel_token",
    present("VERCEL_TOKEN"),
    present("VERCEL_TOKEN") ? "set" : "missing — needed for npm run deploy:production",
    true,
  );
  gate("ghl_api_key", present("GHL_API_KEY"), present("GHL_API_KEY") ? "set" : "missing", false);
  gate(
    "ghl_location",
    present("GHL_LOCATION_ID"),
    present("GHL_LOCATION_ID") ? "set" : "missing",
    false,
  );

  const outbound = await probeGhlOutbound();
  gate("ghl_outbound_write_scope", outbound.ok, outbound.detail, true);

  if (appUrl && appUrl.startsWith("https://") && !appUrl.includes("localhost")) {
    const pub = await probePublicOrigin(appUrl);
    gate("public_health", pub.ok, pub.detail, true);
  } else {
    gate("public_health", false, "skipped — no public HTTPS origin", true);
  }

  const blockers = gates.filter((g) => !g.ok && g.blocker);
  const warnings = gates.filter((g) => !g.ok && !g.blocker);

  console.log("\n--- Summary ---");
  console.log(`Pass: ${gates.filter((g) => g.ok).length}/${gates.length}`);
  console.log(`Blockers: ${blockers.length}`);
  console.log(`Warnings: ${warnings.length}`);

  if (blockers.length > 0) {
    console.log("\nNOT PRODUCTION-COMPLETE");
    console.log("ACTION_REQUIRED blockers:");
    for (const b of blockers) console.log(`  - ${b.id}: ${b.detail}`);
    process.exit(3);
  }

  console.log("\nPRODUCTION-COMPLETE gate passed (secrets + public health + Commas + GHL write).");
  console.log("Still run full E2E: npm run e2e:production");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
