#!/usr/bin/env npx tsx
/**
 * Production HTTP smoke — full borrower flow against live deployment.
 * Usage: APPLY_E2E_BASE_URL=https://os.grantandconsultants.com npx tsx scripts/apply-production-smoke.ts
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { REQUIRED_FOR_SUBMIT } from "@/lib/los/compliance";

const base = (process.env.APPLY_E2E_BASE_URL || "https://os.grantandconsultants.com").replace(/\/$/, "");

type Step = { name: string; ok: boolean; detail?: string };
const steps: Step[] = [];

function record(name: string, ok: boolean, detail?: string) {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function jsonFetch(path: string, init?: RequestInit & { cookie?: string }) {
  const headers = new Headers(init?.headers);
  if (init?.cookie) headers.set("cookie", init.cookie);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
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
  console.log(`=== Production Apply Smoke: ${base} ===\n`);

  const suffix = randomBytes(4).toString("hex");
  const email = `prod-flow-${suffix}@apply-test.grantsandco.com`;
  const password = `LaunchTest-${suffix}!`;

  const reg = await jsonFetch("/api/apply/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      firstName: "Prod",
      lastName: "Flow",
      phone: "5550100777",
    }),
  });
  const cookie = cookieJar(reg.setCookie);
  record("Register", reg.res.status === 201 && Boolean(cookie), `HTTP ${reg.res.status}`);

  const appCreate = await jsonFetch("/api/los/applications", {
    method: "POST",
    cookie,
    body: "{}",
  });
  const appId = (appCreate.body as { applicationId?: string })?.applicationId;
  const loanNumber = (appCreate.body as { loanFile?: { loanNumber?: string } })?.loanFile?.loanNumber;
  record("Create application + LoanFile", appCreate.res.status === 201 && Boolean(appId), loanNumber ?? `HTTP ${appCreate.res.status}`);

  if (!appId) {
    console.error(JSON.stringify(appCreate.body));
    process.exit(1);
  }

  const disclosures = REQUIRED_FOR_SUBMIT.map((type) => ({ type, acknowledged: true }));
  const comp = await jsonFetch(`/api/los/applications/${appId}/compliance`, {
    method: "POST",
    cookie,
    body: JSON.stringify({
      dpaSelected: true,
      disclosures,
      signature: { firstName: "Prod", lastName: "Flow" },
    }),
  });
  record("Disclosures + DPA", comp.res.ok, `HTTP ${comp.res.status}`);

  const borrower = await jsonFetch(`/api/los/applications/${appId}/sections/BORROWER`, {
    method: "PATCH",
    cookie,
    body: JSON.stringify({
      firstNameOnDl: "Prod",
      lastNameOnDl: "Flow",
      dateOfBirth: "1990-01-15",
      ssn: "123-45-6789",
      mobilePhone: "5550100777",
      email,
    }),
  });
  record("Save borrower section", borrower.res.ok, `HTTP ${borrower.res.status}`);
  if (!borrower.res.ok) console.error(JSON.stringify(borrower.body));

  const form = new FormData();
  form.append("file", new Blob(["prod-smoke-pdf"], { type: "application/pdf" }), "id.pdf");
  form.append("kind", "IDENTITY");
  form.append("package", "IDENTITY");
  const docRes = await fetch(`${base}/api/los/applications/${appId}/documents`, {
    method: "POST",
    headers: { cookie },
    body: form,
  });
  const docBody = await docRes.json().catch(() => ({}));
  record("Upload document", docRes.status === 201 && (docBody as { stored?: boolean }).stored === true, `HTTP ${docRes.status}`);

  await jsonFetch(`/api/los/applications/${appId}/qualification`, { method: "POST", cookie });
  const submit = await jsonFetch(`/api/los/applications/${appId}/submit`, { method: "POST", cookie });
  const stage = (submit.body as { loanFile?: { originationStage?: string; loanNumber?: string } })?.loanFile
    ?.originationStage;
  record(
    "Submit → APP_SUBMITTED",
    submit.res.ok && stage === "APP_SUBMITTED",
    stage ?? JSON.stringify(submit.body).slice(0, 120),
  );

  const reload = await jsonFetch(`/api/los/applications/${appId}`, { cookie });
  const reloadedStage = (reload.body as { loanFile?: { originationStage?: string } })?.loanFile?.originationStage;
  record("Reload application", reload.res.ok && reloadedStage === "APP_SUBMITTED", reloadedStage ?? "");

  const applyPage = await fetch(`${base}/apply`, { signal: AbortSignal.timeout(15000) });
  record("/apply page", applyPage.ok, `HTTP ${applyPage.status}`);

  const failed = steps.filter((s) => !s.ok).length;
  console.log(`\n${failed === 0 ? "PRODUCTION SMOKE PASS" : "PRODUCTION SMOKE FAIL"} (${steps.length - failed}/${steps.length})`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
