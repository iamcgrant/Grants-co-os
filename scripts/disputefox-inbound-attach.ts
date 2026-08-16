/**
 * Additive CLI for DisputeFox → Grants inbound attach (existing master records only).
 *
 * Default: idempotent local attach from the checked-in 26-row roster
 * (email + DF stage/started). Does not invent DF numeric IDs.
 *
 * Live pull fails closed without DISPUTEFOX_API_KEY. Zap 374413762 stays OFF.
 * Never writes DisputeFox or GHL. Never sends SMS/email. Never creates Grants clients.
 * Does not print secret values or contact PII.
 *
 *   npx tsx scripts/disputefox-inbound-attach.ts --local --dry-run
 *   npx tsx scripts/disputefox-inbound-attach.ts --local --apply
 *   npx tsx scripts/disputefox-inbound-attach.ts --live
 */
import "dotenv/config";
import { isDisputeFoxApiReady } from "../src/lib/integrations/disputefox/http";
import {
  attachConfirmedDfRoster,
  failClosedWithoutDisputeFoxKey,
  pullDisputeFoxClients,
} from "../src/lib/integrations/disputefox/sync";
import { DISPUTEFOX_API_KEY_ENV, DISPUTEFOX_ZAP_ID } from "../src/lib/integrations/disputefox/secrets";
import type { DfSyncAction, DfSyncResult } from "../src/lib/integrations/disputefox/sync";

const MATCH_ACTIONS = new Set<DfSyncAction>(["UPDATED", "LINKED", "UNCHANGED"]);
const SKIP_ACTIONS = new Set<DfSyncAction>(["SKIPPED_NO_MATCH", "SKIPPED_AMBIGUOUS"]);

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function present(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function summarize(results: DfSyncResult[]) {
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

async function main() {
  const live = argFlag("--live");
  const dryRun = !argFlag("--apply");

  const report: Record<string, unknown> = {
    disputeFoxApiKeyPresent: present(DISPUTEFOX_API_KEY_ENV),
    zapId: DISPUTEFOX_ZAP_ID,
    zapEnabled: false,
    inventedDfIds: false,
    dfWrites: false,
    ghlWrites: false,
    messagesSent: false,
    dryRun,
    dataPlane: process.env.GC_ENV === "production" ? "production" : "development",
  };

  if (live) {
    if (!isDisputeFoxApiReady()) {
      const closed = failClosedWithoutDisputeFoxKey(dryRun);
      console.log(
        JSON.stringify(
          {
            ...report,
            failedClosed: true,
            fetched: 0,
            matched: 0,
            skipped: 0,
            requiredSecrets: closed.requiredSecrets,
            message: `Fail-closed: ${DISPUTEFOX_API_KEY_ENV} is not set.`,
          },
          null,
          2,
        ),
      );
      process.exit(2);
    }

    const pull = await pullDisputeFoxClients({ dryRun });
    console.log(
      JSON.stringify(
        {
          ...report,
          failedClosed: false,
          fetched: pull.fetched,
          liveListEnabled: pull.liveListEnabled,
          ...summarize(pull.results),
          message: pull.message,
        },
        null,
        2,
      ),
    );
    return;
  }

  const local = await attachConfirmedDfRoster({ dryRun });
  const counts = summarize(local.results);
  console.log(
    JSON.stringify(
      {
        ...report,
        mode: "local",
        roster: local.roster,
        attached: local.attached,
        unchanged: local.unchanged,
        skipped: local.skipped,
        inventedDfIds: local.inventedDfIds,
        ...counts,
        message: local.message,
      },
      null,
      2,
    ),
  );
}

main().catch(() => {
  console.log(JSON.stringify({ error: "df_attach_failed", zapEnabled: false }));
  process.exit(1);
});
