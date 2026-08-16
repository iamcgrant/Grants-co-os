/**
 * Phase 2 CRC classifier — activity, not start date.
 *
 * Extends inbound compare (PR #11). Does not invent a second client pipeline.
 *
 * Classes:
 *   CONFIRMED_CONTINUITY_ACTIVE
 *   RECENTLY_WORKED_NEEDS_REVIEW
 *   DORMANT_REACTIVATION
 *   CLOSED
 *
 * Signals: last worked / dispute / report / note / document / comms / payment.
 * `startedAt` alone never marks Active.
 */

import { CRC_RECENT_WORK_WINDOW_MS } from "@/lib/crc-recovery/locks";
import {
  CrcClientClassification,
  classifyCrcClient,
} from "@/lib/crc-recovery/classification";
import type { CrcExportClient } from "@/lib/crc-recovery/types";

export const CrcPhase2Classification = {
  CONFIRMED_CONTINUITY_ACTIVE: "CONFIRMED_CONTINUITY_ACTIVE",
  RECENTLY_WORKED_NEEDS_REVIEW: "RECENTLY_WORKED_NEEDS_REVIEW",
  DORMANT_REACTIVATION: "DORMANT_REACTIVATION",
  CLOSED: "CLOSED",
} as const;

export type CrcPhase2Classification =
  (typeof CrcPhase2Classification)[keyof typeof CrcPhase2Classification];

export const CRC_ACTIVITY_SIGNAL_KEYS = [
  "lastWorkedAt",
  "lastDisputeAt",
  "lastReportAt",
  "lastNoteAt",
  "lastDocumentAt",
  "lastCommsAt",
  "lastPaymentAt",
] as const;

export type CrcActivitySignalKey = (typeof CRC_ACTIVITY_SIGNAL_KEYS)[number];

export type CrcActivitySignals = {
  status?: string | null;
  verifiedActive?: boolean;
  currentlyProcessing?: boolean;
  doNotReactivate?: boolean;
  lastWorkedAt?: string | null;
  lastDisputeAt?: string | null;
  lastReportAt?: string | null;
  lastNoteAt?: string | null;
  lastDocumentAt?: string | null;
  lastCommsAt?: string | null;
  lastPaymentAt?: string | null;
  /** Never used alone to mark Active. */
  startedAt?: string | null;
  cluster?: string | null;
  crcClientStar?: boolean;
  testJunk?: boolean;
};

const CLOSED_STATUS = /\b(closed|cancelled|canceled|refunded|do.?not.?reactivate|terminated)\b/i;

export function parseTimestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : at;
}

export function latestActivityMs(signals: CrcActivitySignals): number | null {
  let latest: number | null = null;
  for (const key of CRC_ACTIVITY_SIGNAL_KEYS) {
    const at = parseTimestampMs(signals[key]);
    if (at === null) continue;
    if (latest === null || at > latest) latest = at;
  }
  return latest;
}

export function hasRecentCrcActivity(signals: CrcActivitySignals, nowMs = Date.now()): boolean {
  const latest = latestActivityMs(signals);
  if (latest === null) return false;
  return nowMs - latest <= CRC_RECENT_WORK_WINDOW_MS && nowMs - latest >= 0;
}

export function startedRecentlyWithoutActivity(
  signals: CrcActivitySignals,
  nowMs = Date.now(),
): boolean {
  const started = parseTimestampMs(signals.startedAt);
  if (started === null) return false;
  const startedRecent = nowMs - started <= CRC_RECENT_WORK_WINDOW_MS && nowMs - started >= 0;
  return startedRecent && !hasRecentCrcActivity(signals, nowMs);
}

function isClosed(signals: CrcActivitySignals): boolean {
  const status = (signals.status || "").trim();
  return Boolean(signals.doNotReactivate) || CLOSED_STATUS.test(status);
}

/**
 * Current-service continuity is confident only with recent CRC activity
 * and verified-active. Currently-processing without verified-active stays
 * RECENTLY_WORKED_NEEDS_REVIEW. Start date is ignored.
 */
export function hasConfirmedContinuity(signals: CrcActivitySignals, nowMs = Date.now()): boolean {
  if (isClosed(signals)) return false;
  if (signals.verifiedActive !== true) return false;
  return hasRecentCrcActivity(signals, nowMs);
}

export function classifyCrcPhase2(
  signals: CrcActivitySignals,
  nowMs = Date.now(),
): CrcPhase2Classification {
  if (isClosed(signals)) return CrcPhase2Classification.CLOSED;

  if (hasConfirmedContinuity(signals, nowMs)) {
    return CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE;
  }

  if (hasRecentCrcActivity(signals, nowMs) || Boolean(signals.currentlyProcessing)) {
    return CrcPhase2Classification.RECENTLY_WORKED_NEEDS_REVIEW;
  }

  return CrcPhase2Classification.DORMANT_REACTIVATION;
}

export function activitySignalsFromCrcExport(client: CrcExportClient): CrcActivitySignals {
  return {
    status: client.status,
    verifiedActive: client.verifiedActive,
    currentlyProcessing: client.currentlyProcessing,
    doNotReactivate: client.doNotReactivate,
    lastWorkedAt: client.lastWorkedAt,
    lastDisputeAt: client.lastDisputeAt,
    lastReportAt: client.lastReportAt,
    lastNoteAt: client.lastNoteAt,
    lastDocumentAt: client.lastDocumentAt,
    lastCommsAt: client.lastCommsAt,
    lastPaymentAt: client.lastPaymentAt,
    startedAt: client.startedAt,
    cluster: client.cluster,
    crcClientStar: client.crcClientStar,
    testJunk: client.testJunk,
  };
}

export function mapPhase1ToPhase2Hint(
  phase1: CrcClientClassification,
): CrcPhase2Classification {
  switch (phase1) {
    case CrcClientClassification.VERIFIED_ACTIVE:
      return CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE;
    case CrcClientClassification.RECENTLY_WORKED_TRANSITION_RISK:
      return CrcPhase2Classification.RECENTLY_WORKED_NEEDS_REVIEW;
    case CrcClientClassification.CLOSED_DO_NOT_REACTIVATE:
      return CrcPhase2Classification.CLOSED;
    default:
      return CrcPhase2Classification.DORMANT_REACTIVATION;
  }
}

/**
 * Phase 2 class is authoritative. Phase 1 remains available for the
 * RECENTLY_WORKED_TRANSITION_RISK work queue.
 */
export function classifyCrcForPhase2(
  client: CrcExportClient,
  nowMs = Date.now(),
): {
  phase1: CrcClientClassification;
  phase2: CrcPhase2Classification;
  recentActivity: boolean;
  startedOnly: boolean;
  confirmedContinuity: boolean;
} {
  const signals = activitySignalsFromCrcExport(client);
  const phase2 = classifyCrcPhase2(signals, nowMs);
  return {
    phase1: classifyCrcClient(client, nowMs),
    phase2,
    recentActivity: hasRecentCrcActivity(signals, nowMs),
    startedOnly: startedRecentlyWithoutActivity(signals, nowMs),
    confirmedContinuity: phase2 === CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE,
  };
}
