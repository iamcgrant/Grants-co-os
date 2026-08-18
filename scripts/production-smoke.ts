#!/usr/bin/env npx tsx
/**
 * Post-deploy production smoke tests against NEXT_PUBLIC_APP_URL.
 * Does not print secrets. Exit 0 only when core public + auth paths pass.
 */
import "dotenv/config";

const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
const ownerEmail = process.env.E2E_OWNER_EMAIL || "owner@grantsandco.com";
const ownerPassword = process.env.E2E_OWNER_PASSWORD || "";
if (!ownerPassword) {
  console.error("ACTION_REQUIRED: set E2E_OWNER_PASSWORD for smoke login (never commit).");
  process.exit(2);
}

type Step = { name: string; ok: boolean; detail?: string };
const steps: Step[] = [];

function record(name: string, ok: boolean, detail?: string) {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  if (!base || base.includes("localhost") || !base.startsWith("https://")) {
    console.error("ACTION_REQUIRED: set NEXT_PUBLIC_APP_URL to https://os.grantandconsultants.com");
    process.exit(2);
  }

  console.log(`Smoke target: ${base}\n`);

  // SSL + public health
  try {
    const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(15000) });
    const body = (await health.json().catch(() => ({}))) as { ok?: boolean };
    record("SSL + /api/health", health.ok && body.ok === true, `HTTP ${health.status}`);
  } catch (e) {
    record("SSL + /api/health", false, e instanceof Error ? e.message : "fetch failed");
  }

  // Webhook route exists (GET probe or POST without signature → 4xx not 404/5xx)
  const wh = await fetch(`${base}/api/webhooks/payments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(15000),
  }).catch((e: Error) => ({ ok: false, status: 0, statusText: e.message }));
  const whStatus = "status" in wh ? wh.status : 0;
  record(
    "Webhook endpoint /api/webhooks/payments",
    whStatus === 400 || whStatus === 401 || whStatus === 200 || whStatus === 201,
    `HTTP ${whStatus} (expect 4xx without valid signature)`,
  );

  // Login page
  const loginPage = await fetch(`${base}/login`, { signal: AbortSignal.timeout(15000) }).catch(
    () => ({ ok: false, status: 0 }),
  );
  record("Login page", "status" in loginPage && loginPage.status < 500, `HTTP ${"status" in loginPage ? loginPage.status : 0}`);

  // Auth API
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);

  let cookie = "";
  if (login) {
    const setCookies = login.headers.getSetCookie?.() || [];
    cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
    record("Owner login API", login.ok && Boolean(cookie), `HTTP ${login.status}`);
  } else {
    record("Owner login API", false, "request failed");
  }

  if (cookie) {
    const dash = await fetch(`${base}/home`, {
      headers: { cookie },
      signal: AbortSignal.timeout(15000),
      redirect: "manual",
    });
    record("Dashboard /home", dash.status < 400 || dash.status === 307 || dash.status === 302, `HTTP ${dash.status}`);

    const clients = await fetch(`${base}/api/clients`, {
      headers: { cookie },
      signal: AbortSignal.timeout(15000),
    });
    record("Clients API (DB)", clients.ok, `HTTP ${clients.status}`);

    const sys = await fetch(`${base}/api/system/health`, {
      headers: { cookie },
      signal: AbortSignal.timeout(15000),
    });
    record("System health API", sys.ok, `HTTP ${sys.status}`);
  }

  // Cron endpoint rejects anonymous
  const cron = await fetch(`${base}/api/automations/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  record(
    "Cron route protected",
    Boolean(cron && (cron.status === 403 || cron.status === 401)),
    cron ? `HTTP ${cron.status}` : "failed",
  );

  if (process.env.GC_CRON_SECRET) {
    const authorized = await fetch(`${base}/api/automations/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gc-cron-secret": process.env.GC_CRON_SECRET,
        Authorization: `Bearer ${process.env.CRON_SECRET || process.env.GC_CRON_SECRET}`,
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(20000),
    }).catch(() => null);
    record(
      "Cron authorized drain",
      Boolean(authorized && authorized.ok),
      authorized ? `HTTP ${authorized.status}` : "failed",
    );
  } else {
    record("Cron authorized drain", false, "GC_CRON_SECRET not in local env for probe");
  }

  const failed = steps.filter((s) => !s.ok);
  console.log(`\nSmoke: ${steps.length - failed.length}/${steps.length} passed`);
  if (failed.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
