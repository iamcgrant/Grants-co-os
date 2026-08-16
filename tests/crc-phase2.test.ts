import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CrcClientClassification } from "../src/lib/crc-recovery/classification";
import { decideCrcClient } from "../src/lib/crc-recovery/decisioning";
import { CRC_DO_NOT_ENROLL, CRC_MIGRATION_SOURCE } from "../src/lib/crc-recovery/locks";
import { GHL_CRC_CUSTOM_FIELDS } from "../src/lib/crc-recovery/ghl-fields";
import { SYNTHETIC_CRC_EXPORT, SYNTHETIC_NOW_MS, syntheticCatalog } from "../src/lib/crc-recovery/synthetic";
import type { CrcExportClient } from "../src/lib/crc-recovery/types";
import {
  CRC_WRITE_ACTIVE_CONTINUITY_ENV,
  CRC_WRITE_DF_CREATE_ENV,
  CRC_WRITE_DOCUMENTS_ENV,
  CRC_WRITE_DORMANT_GHL_ORG_ENV,
  CRC_WRITE_ENRICHMENT_ENV,
  CRC_WRITE_FLAG_ENVS,
  CRC_PHASE2_LIVE_CLIENTS_ENABLED,
  defaultCrcWriteFlags,
  describeCrcWriteFlags,
  isCrcRecoveryWritesIgnored,
  readCrcWriteFlags,
} from "../src/lib/integrations/crc/write-flags";
import { CRC_RECOVERY_WRITES_ENV } from "../src/lib/integrations/crc/secrets";
import {
  CrcPhase2Classification,
  classifyCrcPhase2,
  hasConfirmedContinuity,
  startedRecentlyWithoutActivity,
} from "../src/lib/integrations/crc/phase2-classification";
import { GHL_SERVICE_STATUS_VALUES, GhlServiceStatus, ghlServiceStatusFor } from "../src/lib/integrations/crc/service-status";
import {
  CRC_CHARLES_AOL_EMAIL,
  CRC_DO_NOT_MERGE_IDENTITIES,
  CRC_DO_NOT_MERGE_IDS,
  decideIdentityLock,
  isCharlesAolEmail,
  isDoNotMergeIdentity,
} from "../src/lib/integrations/crc/identity-locks";
import {
  CrcPhase2Queue,
  CRC_PHASE2_QUEUE_PRIORITY,
  CMI_CLUSTER_DATE,
  PHASE2_LIVE_BOOK_HINTS,
  assignPhase2Queues,
  isCrcClientStarName,
} from "../src/lib/integrations/crc/queues";
import { CRC_BATCH_STEPS, planCrcBatchSequence } from "../src/lib/integrations/crc/sequencer";
import {
  planDfCreate,
  planDocumentWrite,
  planPhase2Enrichment,
  planPhase2Write,
} from "../src/lib/integrations/crc/writes";
import { buildPhase2Plan } from "../src/lib/integrations/crc/phase2";
import {
  PHASE2_SYNTHETIC_CLIENTS,
  PHASE2_SYNTHETIC_NOW_MS,
  phase2SyntheticCatalog,
} from "../src/lib/integrations/crc/phase2-fixtures";
import { compareLocalCrcRoster } from "../src/lib/integrations/crc/compare";

const NOW = PHASE2_SYNTHETIC_NOW_MS;

const FLAG_ENVS = [
  CRC_WRITE_ENRICHMENT_ENV,
  CRC_WRITE_ACTIVE_CONTINUITY_ENV,
  CRC_WRITE_DORMANT_GHL_ORG_ENV,
  CRC_WRITE_DOCUMENTS_ENV,
  CRC_WRITE_DF_CREATE_ENV,
  CRC_RECOVERY_WRITES_ENV,
] as const;

function crcById(id: string): CrcExportClient {
  const row = PHASE2_SYNTHETIC_CLIENTS.find((c) => c.crcClientId === id);
  if (!row) throw new Error(`missing phase2 fixture ${id}`);
  return row;
}

describe("CRC Phase 2 — class-gated write scaffolding", () => {
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const name of FLAG_ENVS) {
      prev[name] = process.env[name];
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of FLAG_ENVS) {
      if (prev[name] === undefined) delete process.env[name];
      else process.env[name] = prev[name];
    }
  });

  it("keeps every class-gated write flag default off and ignores the global writes env", () => {
    expect(CRC_WRITE_FLAG_ENVS).toEqual([
      "CRC_WRITE_ENRICHMENT_ENABLED",
      "CRC_WRITE_ACTIVE_CONTINUITY_ENABLED",
      "CRC_WRITE_DORMANT_GHL_ORG_ENABLED",
      "CRC_WRITE_DOCUMENTS_ENABLED",
      "CRC_WRITE_DF_CREATE_ENABLED",
    ]);
    expect(readCrcWriteFlags()).toEqual(defaultCrcWriteFlags());
    expect(defaultCrcWriteFlags()).toEqual({
      enrichment: false,
      activeContinuity: false,
      dormantGhlOrg: false,
      documents: false,
      dfCreate: false,
    });
    expect(CRC_PHASE2_LIVE_CLIENTS_ENABLED).toBe(false);
    expect(isCrcRecoveryWritesIgnored()).toBe(true);

    process.env[CRC_RECOVERY_WRITES_ENV] = "true";
    const described = describeCrcWriteFlags();
    expect(described.globalWritesValueTrue).toBe(true);
    expect(described.globalWritesHonored).toBe(false);
    expect(described.flags).toEqual(defaultCrcWriteFlags());
    expect(described.liveClientsEnabled).toBe(false);
  });

  it("classifies from CRC activity and does not mark Active from start date alone", () => {
    expect(classifyCrcPhase2(crcById("CRC-SYN-P2-ACTIVE"), NOW)).toBe(
      CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE,
    );
    expect(classifyCrcPhase2(crcById("CRC-SYN-P2-RECENT-DF"), NOW)).toBe(
      CrcPhase2Classification.RECENTLY_WORKED_NEEDS_REVIEW,
    );
    expect(classifyCrcPhase2(crcById("CRC-SYN-P2-DORMANT"), NOW)).toBe(
      CrcPhase2Classification.DORMANT_REACTIVATION,
    );
    expect(classifyCrcPhase2(crcById("CRC-SYN-P2-CLOSED"), NOW)).toBe(CrcPhase2Classification.CLOSED);

    const startedOnly = crcById("CRC-SYN-P2-STARTED");
    expect(startedRecentlyWithoutActivity(startedOnly, NOW)).toBe(true);
    expect(hasConfirmedContinuity(startedOnly, NOW)).toBe(false);
    expect(classifyCrcPhase2(startedOnly, NOW)).toBe(CrcPhase2Classification.DORMANT_REACTIVATION);
    expect(classifyCrcPhase2(startedOnly, NOW)).not.toBe(
      CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE,
    );
  });

  it("documents the GHL service-status enum without live GHL writes", () => {
    expect([...GHL_SERVICE_STATUS_VALUES]).toEqual([
      "ACTIVE_CREDIT_CLIENT",
      "RECENTLY_WORKED_REVIEW",
      "DORMANT_REACTIVATION",
      "CLOSED_DO_NOT_REACTIVATE",
      "AMBIGUOUS_IDENTITY",
      "TEST_JUNK",
    ]);
    const serviceField = GHL_CRC_CUSTOM_FIELDS.find((f) => f.key === "service_status");
    expect(serviceField?.type).toBe("enum");
    expect(ghlServiceStatusFor({ classification: CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE })).toBe(
      GhlServiceStatus.ACTIVE_CREDIT_CLIENT,
    );
    expect(ghlServiceStatusFor({ classification: CrcPhase2Classification.RECENTLY_WORKED_NEEDS_REVIEW })).toBe(
      GhlServiceStatus.RECENTLY_WORKED_REVIEW,
    );
    expect(
      ghlServiceStatusFor({
        classification: CrcPhase2Classification.DORMANT_REACTIVATION,
        ambiguous: true,
      }),
    ).toBe(GhlServiceStatus.AMBIGUOUS_IDENTITY);
  });

  it("refuses DF create unless CONFIRMED_CONTINUITY_ACTIVE and the DF flag are both set", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const recent = crcById("CRC-SYN-P2-RECENT-DF");
    const active = crcById("CRC-SYN-P2-ACTIVE");

    const recentOff = planDfCreate({
      client: recent,
      classification: CrcPhase2Classification.RECENTLY_WORKED_NEEDS_REVIEW,
      missingFromDf: true,
    });
    expect(recentOff.refused).toBe(true);
    expect(recentOff.dfCreates).toBe(0);
    expect(recentOff.executed).toBe(false);

    const activeOff = planDfCreate({
      client: active,
      classification: CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE,
      missingFromDf: true,
    });
    expect(activeOff.refused).toBe(true);
    expect(activeOff.flag).toBe(CRC_WRITE_DF_CREATE_ENV);
    expect(activeOff.flagEnabled).toBe(false);

    process.env[CRC_WRITE_DF_CREATE_ENV] = "true";
    process.env[CRC_RECOVERY_WRITES_ENV] = "true";
    const recentOn = planDfCreate({
      client: recent,
      classification: CrcPhase2Classification.RECENTLY_WORKED_NEEDS_REVIEW,
      missingFromDf: true,
    });
    expect(recentOn.refused).toBe(true);
    expect(recentOn.reason).toMatch(/CONFIRMED_CONTINUITY_ACTIVE/);

    const activeOn = planDfCreate({
      client: active,
      classification: CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE,
      missingFromDf: true,
    });
    expect(activeOn.ok).toBe(true);
    expect(activeOn.exactlyOne).toBe(true);
    expect(activeOn.executed).toBe(false);
    expect(activeOn.dfCreates).toBe(0);
    expect(activeOn.liveCreates).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("refuses enrichment overwrite of newer verified OS data", () => {
    const catalog = phase2SyntheticCatalog();
    const os = catalog.osMasters.find((m) => m.grantsClientId === "GC-SYN-P2-0009")!;
    const crc = crcById("CRC-SYN-P2-ENRICH");

    process.env[CRC_WRITE_ENRICHMENT_ENV] = "true";
    const email = planPhase2Enrichment({
      field: "email",
      os,
      crc,
      classification: CrcPhase2Classification.DORMANT_REACTIVATION,
    });
    expect(email.refused).toBe(true);
    expect(email.backfill.action).toBe("CONFLICT_REVIEW");
    expect(email.reason).toMatch(/overwrite/);

    const phone = planPhase2Enrichment({
      field: "phone",
      os,
      crc,
      classification: CrcPhase2Classification.DORMANT_REACTIVATION,
    });
    expect(phone.backfill.action).toBe("FILL_BLANK");
    expect(phone.ok).toBe(true);
    expect(phone.executed).toBe(false);
  });

  it("skips do-not-merge identities and refuses charles AOL create", () => {
    expect(CRC_DO_NOT_MERGE_IDS).toEqual([
      "kimberly-britt",
      "dyquann-mcbride",
      "antionette-greene",
      "taylor-carroll",
      "charles-grant-collision",
      "kendra-thomas",
      "antanaisa-robinson",
    ]);
    expect(CRC_DO_NOT_MERGE_IDENTITIES).toHaveLength(7);

    for (const row of CRC_DO_NOT_MERGE_IDENTITIES) {
      expect(isDoNotMergeIdentity({ firstName: row.firstName, lastName: row.lastName })).toBe(true);
      const merge = planPhase2Write("merge", {
        client: {
          crcClientId: `CRC-SYN-LOCK-${row.id}`,
          firstName: row.firstName,
          lastName: row.lastName,
        },
        classification: CrcPhase2Classification.DORMANT_REACTIVATION,
      });
      expect(merge.refused).toBe(true);
      expect(merge.reason).toMatch(/do not auto-merge|Auto-merge/i);
    }

    expect(isCharlesAolEmail(CRC_CHARLES_AOL_EMAIL)).toBe(true);
    const aol = decideIdentityLock({
      firstName: "Charles",
      lastName: "Grant",
      email: CRC_CHARLES_AOL_EMAIL,
    });
    expect(aol.refuseCreate).toBe(true);
    expect(aol.lockId).toBe("charles-aol-refused");

    const create = planPhase2Write("os_create", {
      client: crcById("CRC-SYN-P2-AOL"),
      classification: CrcPhase2Classification.DORMANT_REACTIVATION,
    });
    expect(create.refused).toBe(true);
    expect(create.reason).toMatch(/charlesjgrant@aol\.com/);
    expect(create.osCreates).toBe(0);
  });

  it("keeps welcome / Friday / enrollment at zero and does not bulk-create Client* in GHL", () => {
    expect(CRC_DO_NOT_ENROLL.welcome).toBe(false);
    expect(CRC_DO_NOT_ENROLL.fridayPulse).toBe(false);
    expect(CRC_DO_NOT_ENROLL.invoices).toBe(false);

    const welcome = planPhase2Write("welcome", {
      client: crcById("CRC-SYN-P2-ACTIVE"),
      classification: CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE,
    });
    const friday = planPhase2Write("friday", {
      client: crcById("CRC-SYN-P2-ACTIVE"),
      classification: CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE,
    });
    expect(welcome.refused).toBe(true);
    expect(friday.refused).toBe(true);
    expect(welcome.enrollments).toBe(0);
    expect(friday.messagesSent).toBe(0);

    const star = crcById("CRC-SYN-P2-STAR");
    const ghl = planPhase2Write("ghl_create", {
      client: star,
      classification: CrcPhase2Classification.DORMANT_REACTIVATION,
      missingFromGhl: true,
      unmatchedCrcClientStar: true,
    });
    expect(isCrcClientStarName(star.firstName, star.lastName)).toBe(true);
    expect(ghl.refused).toBe(true);
    expect(ghl.reason).toMatch(/Do not bulk-create unmatched CRC Client/);
    expect(ghl.ghlCreates).toBe(0);
  });

  it("queues recently-worked first, treats DF-missing Client* as a recovery queue, and dry-runs the sequencer", () => {
    expect(CRC_PHASE2_QUEUE_PRIORITY[0]).toBe(CrcPhase2Queue.RECENTLY_WORKED_TRANSITION_RISK);
    expect(PHASE2_LIVE_BOOK_HINTS.recentlyWorkedTransitionRisk).toBe(72);
    expect(PHASE2_LIVE_BOOK_HINTS.dfMissingCrcClientStar).toBe(14);
    expect(PHASE2_LIVE_BOOK_HINTS.unmatchedCrcClientStarDoNotBulkGhl).toBe(8);
    expect(PHASE2_LIVE_BOOK_HINTS.cmiClusterDate).toBe(CMI_CLUSTER_DATE);

    const catalog = phase2SyntheticCatalog();
    const recent = crcById("CRC-SYN-P2-RECENT-DF");
    const decision = decideCrcClient(recent, catalog, NOW);
    expect(decision.classification).toBe(CrcClientClassification.RECENTLY_WORKED_TRANSITION_RISK);
    expect(decision.dfTransition.autoCreateDisputeFox).toBe(false);

    const queues = assignPhase2Queues({
      client: recent,
      decision,
      phase2: CrcPhase2Classification.RECENTLY_WORKED_NEEDS_REVIEW,
      signals: recent,
    });
    expect(queues.queues[0]).toBe(CrcPhase2Queue.RECENTLY_WORKED_TRANSITION_RISK);
    expect(queues.queues).toContain(CrcPhase2Queue.DF_MISSING_RECOVERY);
    expect(queues.autoDfCreate).toBe(false);

    const cmi = crcById("CRC-SYN-P2-CMI");
    const cmiDecision = decideCrcClient(cmi, catalog, NOW);
    const cmiQueues = assignPhase2Queues({
      client: cmi,
      decision: cmiDecision,
      phase2: classifyCrcPhase2(cmi, NOW),
      signals: cmi,
    });
    expect(cmiQueues.queues).toContain(CrcPhase2Queue.CMI_CLUSTER_2026_03_10);

    const batch = planCrcBatchSequence([
      {
        crcClientId: recent.crcClientId,
        classification: CrcPhase2Classification.RECENTLY_WORKED_NEEDS_REVIEW,
        writeKind: "df_create",
        context: {
          client: recent,
          classification: CrcPhase2Classification.RECENTLY_WORKED_NEEDS_REVIEW,
          missingFromDf: true,
        },
      },
    ]);
    expect(batch.sequence).toEqual(["backup", "write", "verify", "reconcile", "continue"]);
    expect(CRC_BATCH_STEPS).toEqual(["backup", "write", "verify", "reconcile", "continue"]);
    expect(batch.applied).toBe(false);
    expect(batch.dryRun).toBe(true);
    expect(batch.items[0].steps.map((s) => s.step)).toEqual(CRC_BATCH_STEPS);
    expect(batch.items[0].steps[1].write?.refused).toBe(true);
    expect(batch.liveSideEffects.dfCreates).toBe(0);
  });

  it("builds a Phase 2 plan on the existing compare pipeline with zero live side effects", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const plan = buildPhase2Plan({
      clients: PHASE2_SYNTHETIC_CLIENTS,
      catalog: phase2SyntheticCatalog(),
      nowMs: NOW,
    });

    expect(plan.dryRun).toBe(true);
    expect(plan.applied).toBe(false);
    expect(plan.sourceSystem).toBe(CRC_MIGRATION_SOURCE);
    expect(plan.flags.flags).toEqual(defaultCrcWriteFlags());
    expect(plan.enroll.welcome).toBe(false);
    expect(plan.enroll.fridayPulse).toBe(false);
    expect(plan.liveSideEffects.dfCreates).toBe(0);
    expect(plan.liveSideEffects.ghlCreates).toBe(0);
    expect(plan.liveSideEffects.osCreates).toBe(0);
    expect(plan.liveSideEffects.messagesSent).toBe(0);

    const active = plan.clients.find((c) => c.crcClientId === "CRC-SYN-P2-ACTIVE");
    expect(active?.phase2Classification).toBe(CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE);
    expect(active?.writes.dfCreate.refused).toBe(true);

    const started = plan.clients.find((c) => c.crcClientId === "CRC-SYN-P2-STARTED");
    expect(started?.startedOnly).toBe(true);
    expect(started?.phase2Classification).toBe(CrcPhase2Classification.DORMANT_REACTIVATION);

    const aol = plan.clients.find((c) => c.crcClientId === "CRC-SYN-P2-AOL");
    expect(aol?.identityLock.refuseCreate).toBe(true);
    expect(aol?.writes.osCreate.refused).toBe(true);

    const kb = plan.clients.find((c) => c.crcClientId === "CRC-SYN-P2-LOCK-KB");
    expect(kb?.identityLock.skipMerge).toBe(true);
    expect(kb?.queues.queues).toContain(CrcPhase2Queue.DO_NOT_MERGE);

    const rawDoc = planDocumentWrite(
      {
        id: "CRC-DOC-BAD",
        crcClientId: "CRC-SYN-P2-ACTIVE",
        documentType: "CREDIT_REPORT",
        originalDate: "2026-08-01",
        rawIncluded: false,
      },
      CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE,
    );
    expect(rawDoc.sourceSystem).toBe("CREDIT_REPAIR_CLOUD");
    expect(rawDoc.executed).toBe(false);

    const local = await compareLocalCrcRoster({
      catalog: syntheticCatalog(),
      nowMs: SYNTHETIC_NOW_MS,
    });
    expect(local.phase2.dryRun).toBe(true);
    expect(local.writeFlags.flags.dfCreate).toBe(false);
    expect(local.phase2.sequencer.sequence).toEqual(CRC_BATCH_STEPS);
    expect(local.createdClients).toBe(0);
    expect(local.enroll.welcome).toBe(false);
    expect(SYNTHETIC_CRC_EXPORT.sourceSystem).toBe("CREDIT_REPAIR_CLOUD");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
