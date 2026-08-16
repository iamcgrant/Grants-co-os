/**
 * CRC contact recovery dry-run report.
 *
 * Reads a local CRC export fixture (synthetic in repo) and compares it to
 * OS / GHL / DisputeFox catalog shapes. Does not create clients, send
 * messages, publish workflows, or write GHL/DF.
 *
 *   npm run crc:recovery-report
 *   npx tsx scripts/crc-recovery-report.ts --apply
 *
 * Prints counts and CRC/Grants IDs only — no names, emails, phones, or secrets.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { confirmedInboundShapeCatalog, mergeCatalogs } from "../src/lib/crc-recovery/catalog";
import { defaultFixturePaths, loadCatalog, loadCrcExport } from "../src/lib/crc-recovery/load";
import { CRC_RECOVERY_LOCKS, CRC_RECOVERY_WRITES_ENV } from "../src/lib/crc-recovery/locks";
import { buildCrcRecoveryReport } from "../src/lib/crc-recovery/report";
import { SYNTHETIC_NOW_MS } from "../src/lib/crc-recovery/synthetic";
import { applyCrcRecoveryDecisions } from "../src/lib/crc-recovery/writes";
import { decideCrcExport } from "../src/lib/crc-recovery/decisioning";

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function argValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function present(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

async function main() {
  const defaults = defaultFixturePaths();
  const crcPath = argValue("--crc-export") || (fs.existsSync(defaults.crcExport) ? defaults.crcExport : undefined);
  const osPath = argValue("--os-catalog") || (fs.existsSync(defaults.osCatalog) ? defaults.osCatalog : undefined);
  const ghlPath = argValue("--ghl-catalog") || (fs.existsSync(defaults.ghlCatalog) ? defaults.ghlCatalog : undefined);
  const dfPath = argValue("--df-catalog") || (fs.existsSync(defaults.dfCatalog) ? defaults.dfCatalog : undefined);
  const includeConfirmed = argFlag("--include-confirmed-masters");
  const wantApply = argFlag("--apply");

  const crc = loadCrcExport(crcPath);
  let catalog = loadCatalog({ osPath, ghlPath, dfPath });
  if (includeConfirmed) {
    catalog = mergeCatalogs(catalog, confirmedInboundShapeCatalog());
  }

  const report = buildCrcRecoveryReport({
    crcClients: crc.clients,
    catalog,
    nowMs: SYNTHETIC_NOW_MS,
  });

  const apply = wantApply
    ? applyCrcRecoveryDecisions(decideCrcExport(crc.clients, catalog, SYNTHETIC_NOW_MS))
    : undefined;

  const outPath = argValue("--out");
  const payload = {
    crcExportPath: crcPath || "in-memory-synthetic",
    synthetic: crc.synthetic === true,
    writesFlagPresent: present(CRC_RECOVERY_WRITES_ENV),
    writesFlagValueTrue: process.env[CRC_RECOVERY_WRITES_ENV] === "true",
    ghlApiKeyPresent: present("GHL_API_KEY"),
    disputeFoxApiKeyPresent: present("DISPUTEFOX_API_KEY"),
    locks: CRC_RECOVERY_LOCKS,
    report,
    apply: apply
      ? {
          applied: apply.applied,
          refused: apply.refused,
          writesEnabled: apply.writesEnabled,
          osCreates: apply.osCreates,
          ghlCreates: apply.ghlCreates,
          dfCreates: apply.dfCreates,
          messagesSent: apply.messagesSent,
          message: apply.message,
        }
      : { applied: false, dryRun: true },
  };

  const json = JSON.stringify(payload, null, 2);
  if (outPath) {
    const abs = path.resolve(outPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, json);
  }
  console.log(json);
}

main().catch(() => {
  console.log(JSON.stringify({ error: "crc_recovery_report_failed", writes: false }));
  process.exit(1);
});
