import { CRC_RECENT_WORK_WINDOW_MS } from "./locks";

type ClassifiableCrc = {
  status?: string | null;
  verifiedActive?: boolean;
  currentlyProcessing?: boolean;
  doNotReactivate?: boolean;
  lastWorkedAt?: string | null;
};

/**
 * Classification after identity recovery.
 * Do not treat everyone imported from CRC as active.
 */
export const CrcClientClassification = {
  VERIFIED_ACTIVE: "VERIFIED_ACTIVE",
  RECENTLY_WORKED_TRANSITION_RISK: "RECENTLY_WORKED_TRANSITION_RISK",
  DORMANT_REACTIVATION_ELIGIBLE: "DORMANT_REACTIVATION_ELIGIBLE",
  CLOSED_DO_NOT_REACTIVATE: "CLOSED_DO_NOT_REACTIVATE",
} as const;

export type CrcClientClassification =
  (typeof CrcClientClassification)[keyof typeof CrcClientClassification];

const CLOSED_STATUS = /\b(closed|cancelled|canceled|refunded|do.?not.?reactivate|terminated)\b/i;

export function isRecentlyWorked(
  lastWorkedAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!lastWorkedAt) return false;
  const at = Date.parse(lastWorkedAt);
  if (Number.isNaN(at)) return false;
  return nowMs - at <= CRC_RECENT_WORK_WINDOW_MS && nowMs - at >= 0;
}

export function classifyCrcClient(
  client: ClassifiableCrc,
  nowMs = Date.now(),
): CrcClientClassification {
  const status = (client.status || "").trim();
  if (client.doNotReactivate || CLOSED_STATUS.test(status)) {
    return CrcClientClassification.CLOSED_DO_NOT_REACTIVATE;
  }

  const recently = isRecentlyWorked(client.lastWorkedAt, nowMs) || Boolean(client.currentlyProcessing);
  const verifiedActive = client.verifiedActive === true || /^verified[_\s-]?active$/i.test(status);

  if (verifiedActive && recently) {
    return CrcClientClassification.VERIFIED_ACTIVE;
  }
  if (recently) {
    return CrcClientClassification.RECENTLY_WORKED_TRANSITION_RISK;
  }
  return CrcClientClassification.DORMANT_REACTIVATION_ELIGIBLE;
}

export function isDfCreateCandidate(classification: CrcClientClassification): boolean {
  return (
    classification === CrcClientClassification.VERIFIED_ACTIVE ||
    classification === CrcClientClassification.RECENTLY_WORKED_TRANSITION_RISK
  );
}
