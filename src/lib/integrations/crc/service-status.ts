/**
 * GHL organization Service Status for CRC recovery.
 * Document + schema only. Do not live-write GHL. Do not apply tags live.
 *
 * Prisma mirror: enum GhlServiceStatus in prisma/schema.prisma.
 */

import type { CrcPhase2Classification } from "./phase2-classification";

export const GhlServiceStatus = {
  ACTIVE_CREDIT_CLIENT: "ACTIVE_CREDIT_CLIENT",
  RECENTLY_WORKED_REVIEW: "RECENTLY_WORKED_REVIEW",
  DORMANT_REACTIVATION: "DORMANT_REACTIVATION",
  CLOSED_DO_NOT_REACTIVATE: "CLOSED_DO_NOT_REACTIVATE",
  AMBIGUOUS_IDENTITY: "AMBIGUOUS_IDENTITY",
  TEST_JUNK: "TEST_JUNK",
} as const;

export type GhlServiceStatus = (typeof GhlServiceStatus)[keyof typeof GhlServiceStatus];

export const GHL_SERVICE_STATUS_VALUES = [
  GhlServiceStatus.ACTIVE_CREDIT_CLIENT,
  GhlServiceStatus.RECENTLY_WORKED_REVIEW,
  GhlServiceStatus.DORMANT_REACTIVATION,
  GhlServiceStatus.CLOSED_DO_NOT_REACTIVATE,
  GhlServiceStatus.AMBIGUOUS_IDENTITY,
  GhlServiceStatus.TEST_JUNK,
] as const;

export function ghlServiceStatusFor(input: {
  classification: CrcPhase2Classification;
  ambiguous?: boolean;
  testJunk?: boolean;
}): GhlServiceStatus {
  if (input.testJunk) return GhlServiceStatus.TEST_JUNK;
  if (input.ambiguous) return GhlServiceStatus.AMBIGUOUS_IDENTITY;
  switch (input.classification) {
    case "CONFIRMED_CONTINUITY_ACTIVE":
      return GhlServiceStatus.ACTIVE_CREDIT_CLIENT;
    case "RECENTLY_WORKED_NEEDS_REVIEW":
      return GhlServiceStatus.RECENTLY_WORKED_REVIEW;
    case "DORMANT_REACTIVATION":
      return GhlServiceStatus.DORMANT_REACTIVATION;
    case "CLOSED":
      return GhlServiceStatus.CLOSED_DO_NOT_REACTIVATE;
    default:
      return GhlServiceStatus.AMBIGUOUS_IDENTITY;
  }
}
