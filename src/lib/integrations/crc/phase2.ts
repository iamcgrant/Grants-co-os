/**
 * Phase 2 CRC recovery plan — extends inbound compare.
 *
 * Same identity + decisioning pipeline as PR #11 (`decideCrcExport` /
 * `compareLocalCrcRoster`). Adds activity classification, class-gated
 * write plans, queues, and a dry-run batch sequencer.
 */

import { decideCrcExport } from "@/lib/crc-recovery/decisioning";
import { CRC_DO_NOT_ENROLL, CRC_MIGRATION_SOURCE } from "@/lib/crc-recovery/locks";
import type { CrcClientDecision, CrcExportClient, IdentityCatalog } from "@/lib/crc-recovery/types";
import { decideIdentityLock } from "./identity-locks";
import {
  activitySignalsFromCrcExport,
  classifyCrcForPhase2,
  CrcPhase2Classification,
  type CrcPhase2Classification as Phase2Class,
} from "./phase2-classification";
import { assignPhase2Queues, CrcPhase2Queue, PHASE2_LIVE_BOOK_HINTS, type Phase2QueueAssignment } from "./queues";
import { CRC_BATCH_STEPS, planCrcBatchSequence, type CrcBatchPlan } from "./sequencer";
import { ghlServiceStatusFor, type GhlServiceStatus } from "./service-status";
import {
  planDfCreate,
  planPhase2Enrichment,
  planPhase2Write,
  phase2SideEffects,
  type Phase2WriteDecision,
} from "./writes";
import { describeCrcWriteFlags } from "./write-flags";

export type Phase2ClientPlan = {
  crcClientId: string;
  grantsClientId?: string;
  phase1Classification: CrcClientDecision["classification"];
  phase2Classification: Phase2Class;
  serviceStatus: GhlServiceStatus;
  recentActivity: boolean;
  startedOnly: boolean;
  confirmedContinuity: boolean;
  queues: Phase2QueueAssignment;
  identityLock: ReturnType<typeof decideIdentityLock>;
  writes: {
    enrichment: Phase2WriteDecision[];
    dfCreate: Phase2WriteDecision;
    ghlCreate: Phase2WriteDecision;
    osCreate: Phase2WriteDecision;
    merge: Phase2WriteDecision;
    welcome: Phase2WriteDecision;
    friday: Phase2WriteDecision;
    documents: Phase2WriteDecision;
    activeContinuity: Phase2WriteDecision;
  };
};

export type Phase2Plan = {
  dryRun: true;
  applied: false;
  sourceSystem: typeof CRC_MIGRATION_SOURCE;
  flags: ReturnType<typeof describeCrcWriteFlags>;
  enroll: typeof CRC_DO_NOT_ENROLL;
  liveBookHints: typeof PHASE2_LIVE_BOOK_HINTS;
  queuePriority: string[];
  classifications: Record<Phase2Class, number>;
  queueCounts: Record<string, number>;
  clients: Phase2ClientPlan[];
  sequencer: CrcBatchPlan;
  liveSideEffects: ReturnType<typeof phase2SideEffects>;
  message: string;
};

function emptyClassCounts(): Record<Phase2Class, number> {
  return {
    [CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE]: 0,
    [CrcPhase2Classification.RECENTLY_WORKED_NEEDS_REVIEW]: 0,
    [CrcPhase2Classification.DORMANT_REACTIVATION]: 0,
    [CrcPhase2Classification.CLOSED]: 0,
  };
}

export function buildPhase2Plan(input: {
  clients: CrcExportClient[];
  catalog: IdentityCatalog;
  decisions?: CrcClientDecision[];
  nowMs?: number;
}): Phase2Plan {
  const nowMs = input.nowMs ?? Date.now();
  const decisions = input.decisions ?? decideCrcExport(input.clients, input.catalog, nowMs);
  const byId = new Map(input.clients.map((c) => [c.crcClientId, c]));

  const clients: Phase2ClientPlan[] = decisions.map((decision) => {
    const client = byId.get(decision.crcClientId) || {
      crcClientId: decision.crcClientId,
      firstName: "",
      lastName: "",
    };
    const classified = classifyCrcForPhase2(client, nowMs);
    const signals = activitySignalsFromCrcExport(client);
    const queues = assignPhase2Queues({
      client,
      decision,
      phase2: classified.phase2,
      signals,
    });
    const identityLock = decideIdentityLock({
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
    });
    const ctx = {
      client,
      classification: classified.phase2,
      missingFromDf: decision.resolution.df.status === "MISSING",
      missingFromGhl: decision.resolution.ghl.status === "MISSING",
      missingFromOs: decision.resolution.os.status === "MISSING",
      ambiguous: decision.resolution.unified === "AMBIGUOUS",
      unmatchedCrcClientStar: queues.queues.includes(CrcPhase2Queue.UNMATCHED_CRC_CLIENT_STAR),
      queues: queues.queues,
      osMaster: decision.resolution.os.status === "MATCHED" ? decision.resolution.os.hits[0].record : null,
    };

    const enrichment = (["email", "phone", "address"] as const).map((field) =>
      planPhase2Enrichment({
        field,
        os: ctx.osMaster,
        crc: client,
        classification: classified.phase2,
      }),
    );

    return {
      crcClientId: decision.crcClientId,
      grantsClientId: decision.resolution.grantsClientId,
      phase1Classification: decision.classification,
      phase2Classification: classified.phase2,
      serviceStatus: ghlServiceStatusFor({
        classification: classified.phase2,
        ambiguous: ctx.ambiguous,
        testJunk: signals.testJunk,
      }),
      recentActivity: classified.recentActivity,
      startedOnly: classified.startedOnly,
      confirmedContinuity: classified.confirmedContinuity,
      queues,
      identityLock,
      writes: {
        enrichment,
        dfCreate: planDfCreate(ctx),
        ghlCreate: planPhase2Write("ghl_create", ctx),
        osCreate: planPhase2Write("os_create", ctx),
        merge: planPhase2Write("merge", ctx),
        welcome: planPhase2Write("welcome", ctx),
        friday: planPhase2Write("friday", ctx),
        documents: planPhase2Write("documents", ctx),
        activeContinuity: planPhase2Write("active_continuity_link", ctx),
      },
    };
  });

  const classifications = emptyClassCounts();
  const queueCounts: Record<string, number> = {};
  for (const row of clients) {
    classifications[row.phase2Classification] += 1;
    for (const q of row.queues.queues) {
      queueCounts[q] = (queueCounts[q] || 0) + 1;
    }
  }

  const sequencer = planCrcBatchSequence(
    clients.map((row) => ({
      crcClientId: row.crcClientId,
      classification: row.phase2Classification,
      writeKind: "df_create",
      context: {
        client: byId.get(row.crcClientId) || {
          crcClientId: row.crcClientId,
          firstName: "",
          lastName: "",
        },
        classification: row.phase2Classification,
        missingFromDf: row.writes.dfCreate.reason.includes("already present") ? false : true,
        unmatchedCrcClientStar: row.queues.queues.includes(CrcPhase2Queue.UNMATCHED_CRC_CLIENT_STAR),
        queues: row.queues.queues,
        ambiguous: row.serviceStatus === "AMBIGUOUS_IDENTITY",
      },
    })),
  );

  return {
    dryRun: true,
    applied: false,
    sourceSystem: CRC_MIGRATION_SOURCE,
    flags: describeCrcWriteFlags(),
    enroll: CRC_DO_NOT_ENROLL,
    liveBookHints: PHASE2_LIVE_BOOK_HINTS,
    queuePriority: [
      CrcPhase2Queue.RECENTLY_WORKED_TRANSITION_RISK,
      CrcPhase2Queue.DF_MISSING_RECOVERY,
      CrcPhase2Queue.CMI_CLUSTER_2026_03_10,
    ],
    classifications,
    queueCounts,
    clients,
    sequencer,
    liveSideEffects: phase2SideEffects(),
    message:
      "Phase 2 controlled-write scaffolding. Class-gated flags default off. CRC_RECOVERY_WRITES_ENABLED ignored. No live GHL/DF/OS clients, messages, or workflow publish.",
  };
}

export { CRC_BATCH_STEPS };
