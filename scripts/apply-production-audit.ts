#!/usr/bin/env npx tsx
/**
 * Production activation readiness audit — never prints secret values.
 */
import "dotenv/config";

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

function check(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}

function present(name: string): boolean {
  const v = process.env[name];
  return Boolean(v && v.trim().length > 0);
}

function isPostgres(url: string | undefined): boolean {
  return Boolean(url?.startsWith("postgres://") || url?.startsWith("postgresql://"));
}

async function probe(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const text = await res.text().catch(() => "");
    return { ok: res.ok, detail: `HTTP ${res.status} ${text.slice(0, 80)}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "fetch failed" };
  }
}

async function main() {
  console.log("=== Mortgage Apply Portal — Production Activation Audit ===\n");

  const db = process.env.DATABASE_URL || "";
  check("DATABASE_URL present", present("DATABASE_URL"), isPostgres(db) ? "postgresql" : db.startsWith("file:") ? "sqlite (local)" : "unknown");
  check("MORTGAGE_PII_KEY present", present("MORTGAGE_PII_KEY"), present("MORTGAGE_PII_KEY") ? "set (value hidden)" : "missing");
  check("AUTH_SECRET present", present("AUTH_SECRET"), present("AUTH_SECRET") ? "set" : "missing");
  check("GC_CRON_SECRET or CRON_SECRET", present("GC_CRON_SECRET") || present("CRON_SECRET"), "cron auth");
  check("GHL_API_KEY", present("GHL_API_KEY"), present("GHL_API_KEY") ? "set" : "missing");
  check("GHL_LOCATION_ID", present("GHL_LOCATION_ID"), present("GHL_LOCATION_ID") ? "set" : "missing");
  check("VERCEL_TOKEN (deploy tooling)", present("VERCEL_TOKEN"), present("VERCEL_TOKEN") ? "set" : "ACTION_REQUIRED for domain/deploy CLI");

  const migrations = [
    "20260816183800_platform_inbox_agents",
    "20260823213500_los_mortgage",
    "20260823220000_schema_relation_fixes",
    "20260823230000_los_launch_document_payment",
  ];
  for (const m of migrations) {
    const fs = await import("node:fs/promises");
    try {
      await fs.access(`prisma/migrations/${m}/migration.sql`);
      check(`migration ${m}`, true, "present");
    } catch {
      check(`migration ${m}`, false, "missing");
    }
  }

  const vercel = await probe("https://os.grantandconsultants.com/api/health");
  check("os.grantandconsultants.com health", vercel.ok, vercel.detail);

  const applyOs = await probe("https://os.grantandconsultants.com/apply");
  check("os.grantandconsultants.com/apply", applyOs.ok, applyOs.detail);

  const applySub = await probe("https://apply.grantandconsultants.com/apply");
  check("apply.grantandconsultants.com DNS+SSL", applySub.ok, applySub.detail);

  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\nAudit: ${checks.length - failed}/${checks.length} pass`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
