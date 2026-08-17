#!/usr/bin/env npx tsx
/**
 * Production / pre-prod E2E QA harness.
 * Targets NEXT_PUBLIC_APP_URL (default http://127.0.0.1:3000).
 * Never prints secrets. Fails closed when Commas is required but missing.
 */
import "dotenv/config";

const base = (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const ownerEmail = process.env.E2E_OWNER_EMAIL || "owner@grantsandco.com";
const ownerPassword = process.env.E2E_OWNER_PASSWORD || "GrantsCo2026!";

type Step = { name: string; ok: boolean; detail?: string };

const steps: Step[] = [];
function record(name: string, ok: boolean, detail?: string) {
  steps.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function jsonFetch(path: string, init?: RequestInit & { cookie?: string }) {
  const headers = new Headers(init?.headers);
  if (init?.cookie) headers.set("cookie", init.cookie);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${base}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, setCookie: res.headers.getSetCookie?.() || [] };
}

function cookieJar(setCookies: string[]): string {
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

async function main() {
  console.log(`E2E target: ${base}`);

  const health = await jsonFetch("/api/health");
  record(
    "Public health",
    health.res.ok && (health.body as { ok?: boolean })?.ok === true,
    JSON.stringify(health.body),
  );

  const login = await jsonFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
  });
  const cookie = cookieJar(login.setCookie);
  record("Owner login", login.res.ok && Boolean(cookie), `status=${login.res.status}`);

  const sys = await jsonFetch("/api/system/health", { cookie });
  const overall = (sys.body as { overall?: string })?.overall;
  record("System health API", sys.res.ok, `overall=${overall}`);

  const clients = await jsonFetch("/api/clients", { cookie });
  const clientList = (clients.body as { clients?: Array<{ id: string }> })?.clients || [];
  record("List clients", clients.res.ok && clientList.length > 0, `count=${clientList.length}`);

  const search = await jsonFetch("/api/search?q=Donna", { cookie });
  const hits = (search.body as { hits?: unknown[] })?.hits || [];
  record("Universal search", search.res.ok, `hits=${hits.length}`);

  let payOk = false;
  let payDetail = "";
  if (clientList[0]) {
    const pr = await jsonFetch("/api/pay/requests", {
      method: "POST",
      cookie,
      body: JSON.stringify({
        clientId: clientList[0].id,
        amountCents: 10000,
        serviceName: "E2E Credit Optimization",
        sendEmail: true,
        sendSms: false,
      }),
    });
    payOk = pr.res.status === 201;
    const invoiceNumber = (pr.body as { invoice?: { invoiceNumber?: string } })?.invoice
      ?.invoiceNumber;
    payDetail = `status=${pr.res.status} invoice=${invoiceNumber}`;

    if (invoiceNumber && process.env.PAYMENT_PROVIDER !== "commas") {
      const inv = await jsonFetch(`/api/pay/invoice/${invoiceNumber}`);
      const invoiceId = (inv.body as { invoice?: { id?: string } })?.invoice?.id;
      if (invoiceId) {
        const charge = await jsonFetch("/api/pay/charge", {
          method: "POST",
          body: JSON.stringify({
            invoiceId,
            paymentToken: "tok_visa_4242",
            idempotencyKey: `e2e-${Date.now()}`,
          }),
        });
        const status = (charge.body as { transaction?: { status?: string } })?.transaction?.status;
        record("Mock charge (local only)", status === "SUCCEEDED", `txn=${status}`);
        const auto = await jsonFetch("/api/automations/run", {
          method: "POST",
          cookie,
          body: JSON.stringify({}),
        });
        record("Drain automations", auto.res.ok, JSON.stringify(auto.body));
      }
    } else if (process.env.PAYMENT_PROVIDER === "commas") {
      record(
        "Commas checkout",
        Boolean((pr.body as { link?: { url?: string } })?.link?.url?.includes("http")),
        "Open payment_link in sandbox; confirm webhook → intake",
      );
    }
  }
  record("Create payment request", payOk, payDetail);

  const pages = [
    "/login",
    "/home",
    "/pay",
    "/system-health",
    "/search",
    "/automations",
    "/intelligence",
    "/inbox",
  ];
  for (const p of pages) {
    const res = await fetch(`${base}${p}`, { headers: cookie ? { cookie } : {} });
    record(`Page ${p}`, res.status < 500, `HTTP ${res.status}`);
  }

  const failed = steps.filter((s) => !s.ok);
  console.log("\n--- SUMMARY ---");
  console.log(`Passed ${steps.length - failed.length}/${steps.length}`);
  if (failed.length) {
    console.log("Failures:");
    for (const f of failed) console.log(` - ${f.name}: ${f.detail || ""}`);
    process.exit(1);
  }

  if (process.env.PAYMENT_PROVIDER !== "commas" || !process.env.COMMAS_API_KEY) {
    console.log(
      "\nNOT PRODUCTION-COMPLETE: PAYMENT_PROVIDER is not commas with live sandbox credentials.",
    );
    process.exit(3);
  }
  console.log("\nE2E harness green under current configuration.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
