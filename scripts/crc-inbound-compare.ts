/**
 * Additive CLI for CRC → Grants inbound compare (existing master records only).
 *
 * Copies the DisputeFox inbound-attach CLI shape (PR #8).
 * Default: local synthetic CSV roster dry-run. Never creates contacts.
 *
 * Live pull fails closed without CRC_API_KEY. CRC_RECOVERY_WRITES_ENABLED stays false.
 * Never writes CRC, GHL, or DisputeFox. Never sends SMS/email. Zap 374413762 stays OFF.
 * Does not print secret values or contact PII.
 *
 *   npm run crc:inbound-compare -- --local --dry-run
 *   npx tsx scripts/crc-inbound-compare.ts --live
 */
import "dotenv/config";
import { isCrcApiReady } from "../src/lib/integrations/crc/http";
import {
  compareLocalCrcRoster,
  failClosedWithoutCrcKey,
  pullCrcClients,
} from "../src/lib/integrations/crc/compare";
import { CRC_API_KEY_ENV, CRC_RECOVERY_WRITES_ENV } from "../src/lib/integrations/crc/secrets";
import { CRC_RECOVERY_REPORT_TITLE } from "../src/lib/crc-recovery/report";
import type { CrcCompareAction, CrcCompareResult } from "../src/lib/integrations/crc/compare";

const MATCH_ACTIONS = new Set<CrcCompareAction>(["MATCHED"]);
const SKIP_ACTIONS = new Set<CrcCompareAction>(["SKIPPED_NO_MATCH", "SKIPPED_AMBIGUOUS"]);

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

function summarize(results: CrcCompareResult[]) {
  const actions: Record<string, number> = {};
  let matched = 0;
  let skipped = 0;
  for (const r of results) {
    const action = r.action || "UNKNOWN";
    actions[action] = (actions[action] || 0) + 1;
    if (MATCH_ACTIONS.has(r.action)) matched += 1;
    else if (SKIP_ACTIONS.has(r.action)) skipped += 1;
  }
  return { matched, skipped, actions };
}

function sectionCounts(report: Awaited<ReturnType<typeof compareLocalCrcRoster>>["report"]) {
  const out: Record<string, number> = {};
  for (const section of Object.values(report.sections)) {
    out[section.title] = section.count;
  }
  return out;
}

async function main() {
  const live = argFlag("--live");
  const dryRun = !argFlag("--apply");

  const payload: Record<string, unknown> = {
    crcApiKeyPresent: present(CRC_API_KEY_ENV),
    writesFlagPresent: present(CRC_RECOVERY_WRITES_ENV),
    writesEnabled: process.env[CRC_RECOVERY_WRITES_ENV] === "true",
    createdClients: 0,
    crcWrites: false,
    ghlWrites: false,
    dfWrites: false,
    messagesSent: false,
    zapEnabled: false,
    dryRun: true,
    title: CRC_RECOVERY_REPORT_TITLE,
    dataPlane: process.env.GC_ENV === "production" ? "production" : "development",
  };

  if (live) {
    if (!isCrcApiReady()) {
      const closed = failClosedWithoutCrcKey(dryRun);
      console.log(
        JSON.stringify(
          {
            ...payload,
            failedClosed: true,
            fetched: 0,
            matched: 0,
            skipped: 0,
            requiredSecrets: closed.requiredSecrets,
            message: `Fail-closed: ${CRC_API_KEY_ENV} is not set.`,
          },
          null,
          2,
        ),
      );
      process.exit(2);
    }

    const pull = await pullCrcClients({ dryRun });
    console.log(
      JSON.stringify(
        {
          ...payload,
          failedClosed: false,
          fetched: pull.fetched,
          liveListEnabled: pull.liveListEnabled,
          createdClients: pull.createdClients,
          ...summarize(pull.results),
          message: pull.message,
        },
        null,
        2,
      ),
    );
    return;
  }

  const local = await compareLocalCrcRoster({
    csvPath: argValue("--csv"),
    osPath: argValue("--os-catalog"),
    ghlPath: argValue("--ghl-catalog"),
    dfPath: argValue("--df-catalog"),
  });
  const counts = summarize(local.results);
  console.log(
    JSON.stringify(
      {
        ...payload,
        mode: "local",
        roster: local.roster,
        matched: local.matched,
        skipped: local.skipped,
        createdClients: local.createdClients,
        writesEnabled: local.writesEnabled,
        applyRefused: local.applyRefused,
        enroll: local.enroll,
        classifications: local.report.classifications,
        phase2Classifications: local.phase2.classifications,
        phase2QueueCounts: local.phase2.queueCounts,
        writeFlags: {
          enrichment: local.writeFlags.flags.enrichment,
          activeContinuity: local.writeFlags.flags.activeContinuity,
          dormantGhlOrg: local.writeFlags.flags.dormantGhlOrg,
          documents: local.writeFlags.flags.documents,
          dfCreate: local.writeFlags.flags.dfCreate,
          globalWritesHonored: local.writeFlags.globalWritesHonored,
        },
        sequencer: local.phase2.sequencer.sequence,
        liveSideEffects: local.report.liveSideEffects,
        sections: sectionCounts(local.report),
        ...counts,
        message: local.message,
      },
      null,
      2,
    ),
  );
}

main().catch(() => {
  console.log(JSON.stringify({ error: "crc_compare_failed", writes: false, createdClients: 0 }));
  process.exit(1);
});
