/**
 * Additive CLI for GHL → Grants inbound sync (existing master records only).
 *
 * Uses the same pull/match/upsert path as POST /api/integrations/ghl/sync.
 * Paginates past the Hub route's 50-contact cap. Never writes GHL contacts.
 * Never sends SMS/email. Never creates Grants clients. Fail-closed without GHL_API_KEY.
 *
 * Does not print secret values, contact PII, or location ids.
 *
 *   npx tsx scripts/ghl-inbound-sync.ts --dry-run
 *   npx tsx scripts/ghl-inbound-sync.ts --apply
 */
import "dotenv/config";
import { isGhlApiReady, listGhlContacts, searchGhlContacts } from "../src/lib/integrations/ghl/http";
import {
  failClosedWithoutGhlKey,
  markGhlInboundConnection,
  syncGhlContactToGrants,
} from "../src/lib/integrations/ghl/sync";
import { resolveGhlLocationId } from "../src/lib/integrations/ghl/location";
import type { SyncAction, SyncContactResult } from "../src/lib/integrations/ghl/sync";

const MATCH_ACTIONS = new Set<SyncAction>(["UPDATED", "LINKED", "UNCHANGED"]);
const SKIP_ACTIONS = new Set<SyncAction>(["SKIPPED_NO_MATCH", "SKIPPED_AMBIGUOUS"]);

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function argValue(name: string, fallback: number): number {
  const prefix = `${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return fallback;
  const n = Number(hit.slice(prefix.length));
  return Number.isFinite(n) ? n : fallback;
}

function expectedLocationId(): string | null {
  const prefix = "--expect-location=";
  const fromArg = process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length).trim();
  const fromEnv = process.env.GHL_EXPECTED_LOCATION_ID?.trim();
  return fromArg || fromEnv || null;
}

function present(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function summarize(results: SyncContactResult[]) {
  const actions: Record<string, number> = {};
  let matched = 0;
  let skipped = 0;
  let errors = 0;
  for (const r of results) {
    const action = r.action || "UNKNOWN";
    actions[action] = (actions[action] || 0) + 1;
    if (MATCH_ACTIONS.has(r.action)) matched += 1;
    else if (SKIP_ACTIONS.has(r.action)) skipped += 1;
    else errors += 1;
  }
  return { matched, skipped, errors, actions };
}

async function fetchAllContacts(pageLimit: number, maxContacts: number) {
  const contacts = [];
  const seen = new Set<string>();

  let page = 1;
  for (;;) {
    const searched = await searchGhlContacts({ page, pageLimit });
    if (!searched.contacts.length) break;
    for (const c of searched.contacts) {
      if (!c.id || seen.has(c.id)) continue;
      seen.add(c.id);
      contacts.push(c);
      if (contacts.length >= maxContacts) {
        return { contacts, truncated: true, reportedTotal: searched.total ?? null };
      }
    }
    if (searched.contacts.length < pageLimit) {
      return { contacts, truncated: false, reportedTotal: searched.total ?? null };
    }
    page += 1;
    if (page > 200) break;
  }

  if (contacts.length === 0) {
    let startAfterId: string | undefined;
    for (;;) {
      const listed = await listGhlContacts({ limit: pageLimit, startAfterId });
      if (!listed.contacts.length) break;
      for (const c of listed.contacts) {
        if (!c.id || seen.has(c.id)) continue;
        seen.add(c.id);
        contacts.push(c);
        if (contacts.length >= maxContacts) {
          return { contacts, truncated: true, reportedTotal: listed.total ?? null };
        }
      }
      const lastId = listed.contacts[listed.contacts.length - 1]?.id;
      if (!lastId || lastId === startAfterId || listed.contacts.length < pageLimit) break;
      startAfterId = lastId;
    }
  }

  return { contacts, truncated: contacts.length >= maxContacts, reportedTotal: null as number | null };
}

async function main() {
  const dryRun = !argFlag("--apply");
  const pageLimit = Math.min(Math.max(argValue("--page-limit", 100), 1), 100);
  const maxContacts = Math.min(Math.max(argValue("--max-contacts", 2000), 1), 5000);

  const report: Record<string, unknown> = {
    ghlApiKeyPresent: present("GHL_API_KEY"),
    ghlLocationIdPresent: present("GHL_LOCATION_ID"),
    locationMatchesRequested: expectedLocationId()
      ? resolveGhlLocationId() === expectedLocationId()
      : null,
    dryRun,
    dataPlane: process.env.GC_ENV === "production" ? "production" : "development",
  };

  if (!isGhlApiReady()) {
    const closed = failClosedWithoutGhlKey(dryRun);
    console.log(
      JSON.stringify(
        {
          ...report,
          failedClosed: true,
          fetched: 0,
          matched: 0,
          skipped: 0,
          errors: 0,
          requiredSecrets: closed.requiredSecrets,
          message: "Fail-closed: GHL_API_KEY is not set.",
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  const pulled = await fetchAllContacts(pageLimit, maxContacts);
  const results: SyncContactResult[] = [];
  let thrown = 0;
  for (const contact of pulled.contacts) {
    try {
      results.push(await syncGhlContactToGrants(contact, undefined, { dryRun }));
    } catch {
      thrown += 1;
    }
  }

  const counts = summarize(results);
  counts.errors += thrown;

  if (!dryRun) {
    await markGhlInboundConnection("CONNECTED");
  }

  console.log(
    JSON.stringify(
      {
        ...report,
        failedClosed: false,
        fetched: pulled.contacts.length,
        reportedTotal: pulled.reportedTotal,
        truncated: pulled.truncated,
        ...counts,
        message: dryRun
          ? "Dry-run: no Grants client writes. No GHL contact creates/updates/deletes."
          : "Inbound sync onto existing master client records only. No GHL writes.",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  const status = e && typeof e === "object" && "status" in e ? Number((e as { status: number }).status) : 1;
  console.log(
    JSON.stringify(
      {
        failedClosed: status === 503,
        error: "ghl_sync_failed",
        httpStatus: Number.isFinite(status) ? status : 1,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
