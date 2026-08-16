/**
 * Phase 2 recovery queues. Extends inbound compare — not a second pipeline.
 *
 * Work order (Charles 2026-08-16):
 *   1. RECENTLY_WORKED_TRANSITION_RISK first (live book ~72)
 *   2. especially the 14 CRC Client* missing from DF (recovery queue, not auto-DF-create)
 *   3. especially the 03/10/2026 CMI cluster
 *
 * The 8 unmatched CRC Client* stay parked — do not bulk-create in GHL.
 */

import { CrcClientClassification } from "@/lib/crc-recovery/classification";
import type { CrcClientDecision, CrcExportClient } from "@/lib/crc-recovery/types";
import { CrcPhase2Classification, type CrcActivitySignals } from "./phase2-classification";
import { decideIdentityLock, isCharlesAolEmail } from "./identity-locks";

export const CrcPhase2Queue = {
  RECENTLY_WORKED_TRANSITION_RISK: "RECENTLY_WORKED_TRANSITION_RISK",
  DF_MISSING_RECOVERY: "DF_MISSING_RECOVERY",
  CMI_CLUSTER_2026_03_10: "CMI_CLUSTER_2026_03_10",
  CONFIRMED_CONTINUITY_LINK: "CONFIRMED_CONTINUITY_LINK",
  ENRICHMENT_BLANKS: "ENRICHMENT_BLANKS",
  DOCUMENT_METADATA: "DOCUMENT_METADATA",
  DORMANT_GHL_ORG: "DORMANT_GHL_ORG",
  UNMATCHED_CRC_CLIENT_STAR: "UNMATCHED_CRC_CLIENT_STAR",
  DO_NOT_MERGE: "DO_NOT_MERGE",
  CHARLES_AOL_REFUSED: "CHARLES_AOL_REFUSED",
} as const;

export type CrcPhase2Queue = (typeof CrcPhase2Queue)[keyof typeof CrcPhase2Queue];

/** Work first → parked last. */
export const CRC_PHASE2_QUEUE_PRIORITY: readonly CrcPhase2Queue[] = [
  CrcPhase2Queue.RECENTLY_WORKED_TRANSITION_RISK,
  CrcPhase2Queue.DF_MISSING_RECOVERY,
  CrcPhase2Queue.CMI_CLUSTER_2026_03_10,
  CrcPhase2Queue.CONFIRMED_CONTINUITY_LINK,
  CrcPhase2Queue.ENRICHMENT_BLANKS,
  CrcPhase2Queue.DOCUMENT_METADATA,
  CrcPhase2Queue.DORMANT_GHL_ORG,
  CrcPhase2Queue.UNMATCHED_CRC_CLIENT_STAR,
  CrcPhase2Queue.DO_NOT_MERGE,
  CrcPhase2Queue.CHARLES_AOL_REFUSED,
];

/**
 * Live-book size hints for operators. Synthetic fixtures do not contain
 * the real 72/14/8 rows. Never treat these counts as a create quota.
 */
export const PHASE2_LIVE_BOOK_HINTS = {
  recentlyWorkedTransitionRisk: 72,
  dfMissingCrcClientStar: 14,
  unmatchedCrcClientStarDoNotBulkGhl: 8,
  cmiClusterDate: "2026-03-10",
  cmiClusterId: "CMI_2026_03_10",
} as const;

export const CMI_CLUSTER_ID = PHASE2_LIVE_BOOK_HINTS.cmiClusterId;
export const CMI_CLUSTER_DATE = PHASE2_LIVE_BOOK_HINTS.cmiClusterDate;

export function isCrcClientStarName(
  firstName?: string | null,
  lastName?: string | null,
): boolean {
  const first = (firstName || "").trim();
  const last = (lastName || "").trim();
  if (/^client\d*$/i.test(first)) return true;
  return /^client(\s+\d+)?$/i.test(`${first} ${last}`.trim());
}

export function isCmiCluster(signals: CrcActivitySignals): boolean {
  if (signals.cluster === CMI_CLUSTER_ID) return true;
  const keys = [
    signals.lastWorkedAt,
    signals.lastDisputeAt,
    signals.lastReportAt,
    signals.lastNoteAt,
    signals.lastDocumentAt,
    signals.lastCommsAt,
    signals.lastPaymentAt,
  ];
  return keys.some((value) => Boolean(value && value.startsWith(CMI_CLUSTER_DATE)));
}

export function queuePriority(queue: CrcPhase2Queue): number {
  const idx = CRC_PHASE2_QUEUE_PRIORITY.indexOf(queue);
  return idx === -1 ? CRC_PHASE2_QUEUE_PRIORITY.length : idx;
}

export function sortPhase2Queues(queues: Iterable<CrcPhase2Queue>): CrcPhase2Queue[] {
  return [...new Set(queues)].sort((a, b) => queuePriority(a) - queuePriority(b));
}

export type Phase2QueueAssignment = {
  crcClientId: string;
  queues: CrcPhase2Queue[];
  primaryQueue: CrcPhase2Queue | null;
  parked: boolean;
  autoDfCreate: false;
  autoGhlCreate: false;
};

export function assignPhase2Queues(input: {
  client: CrcExportClient;
  decision: CrcClientDecision;
  phase2: CrcPhase2Classification;
  signals: CrcActivitySignals;
}): Phase2QueueAssignment {
  const queues: CrcPhase2Queue[] = [];
  const lock = decideIdentityLock({
    firstName: input.client.firstName,
    lastName: input.client.lastName,
    email: input.client.email,
  });

  if (isCharlesAolEmail(input.client.email)) {
    queues.push(CrcPhase2Queue.CHARLES_AOL_REFUSED);
  }
  if (lock.skipMerge && lock.lockId !== "charles-aol-refused") {
    queues.push(CrcPhase2Queue.DO_NOT_MERGE);
  }

  const recentlyWorked =
    input.decision.classification === CrcClientClassification.RECENTLY_WORKED_TRANSITION_RISK ||
    input.phase2 === CrcPhase2Classification.RECENTLY_WORKED_NEEDS_REVIEW;
  if (recentlyWorked) {
    queues.push(CrcPhase2Queue.RECENTLY_WORKED_TRANSITION_RISK);
  }

  const missingDf = input.decision.resolution.df.status === "MISSING";
  const clientStar =
    input.signals.crcClientStar === true ||
    isCrcClientStarName(input.client.firstName, input.client.lastName);
  if (missingDf && (recentlyWorked || clientStar || input.phase2 === CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE)) {
    queues.push(CrcPhase2Queue.DF_MISSING_RECOVERY);
  }

  if (isCmiCluster(input.signals)) {
    queues.push(CrcPhase2Queue.CMI_CLUSTER_2026_03_10);
  }

  if (input.phase2 === CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE) {
    queues.push(CrcPhase2Queue.CONFIRMED_CONTINUITY_LINK);
  }

  if (input.decision.backfills.some((b) => b.action === "FILL_BLANK")) {
    queues.push(CrcPhase2Queue.ENRICHMENT_BLANKS);
  }

  if ((input.client.documents || []).length > 0) {
    queues.push(CrcPhase2Queue.DOCUMENT_METADATA);
  }

  if (input.phase2 === CrcPhase2Classification.DORMANT_REACTIVATION) {
    queues.push(CrcPhase2Queue.DORMANT_GHL_ORG);
  }

  const unmatchedGhl = input.decision.resolution.ghl.status === "MISSING";
  const unmatchedOs = input.decision.resolution.os.status === "MISSING";
  if (clientStar && unmatchedGhl && unmatchedOs) {
    queues.push(CrcPhase2Queue.UNMATCHED_CRC_CLIENT_STAR);
  }

  const sorted = sortPhase2Queues(queues);
  const parked =
    sorted.includes(CrcPhase2Queue.DO_NOT_MERGE) ||
    sorted.includes(CrcPhase2Queue.CHARLES_AOL_REFUSED) ||
    sorted.includes(CrcPhase2Queue.UNMATCHED_CRC_CLIENT_STAR);

  return {
    crcClientId: input.client.crcClientId,
    queues: sorted,
    primaryQueue: sorted[0] ?? null,
    parked,
    autoDfCreate: false,
    autoGhlCreate: false,
  };
}
