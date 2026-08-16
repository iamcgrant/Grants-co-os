/**
 * Phase 2 identity locks — do not auto-merge, do not create Charles AOL.
 *
 * Names are Charles-specified collision keys (2026-08-16). They are not a
 * client roster and are never printed in public recovery reports.
 */

import { normalizeEmail, normalizePersonName } from "@/lib/clients/identity";

export const CRC_CHARLES_AOL_EMAIL = "charlesjgrant@aol.com";

export type CrcDoNotMergeIdentity = {
  id: string;
  firstName: string;
  lastName: string;
  reason: string;
};

export const CRC_DO_NOT_MERGE_IDENTITIES: readonly CrcDoNotMergeIdentity[] = [
  {
    id: "kimberly-britt",
    firstName: "Kimberly",
    lastName: "Britt",
    reason: "Ambiguous identity — do not auto-merge",
  },
  {
    id: "dyquann-mcbride",
    firstName: "Dyquann",
    lastName: "McBride",
    reason: "Ambiguous identity — do not auto-merge",
  },
  {
    id: "antionette-greene",
    firstName: "Antionette",
    lastName: "Greene",
    reason: "Ambiguous identity — do not auto-merge",
  },
  {
    id: "taylor-carroll",
    firstName: "Taylor",
    lastName: "Carroll",
    reason: "Ambiguous identity — do not auto-merge",
  },
  {
    id: "charles-grant-collision",
    firstName: "Charles",
    lastName: "Grant",
    reason: "Charles Grant collision — do not auto-merge",
  },
  {
    id: "kendra-thomas",
    firstName: "Kendra",
    lastName: "Thomas",
    reason: "Ambiguous identity — do not auto-merge",
  },
  {
    id: "antanaisa-robinson",
    firstName: "Antanaisa",
    lastName: "Robinson",
    reason: "Ambiguous identity — do not auto-merge",
  },
] as const;

export const CRC_DO_NOT_MERGE_IDS = CRC_DO_NOT_MERGE_IDENTITIES.map((row) => row.id);

export type IdentityLockInput = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  lockId?: string | null;
};

export function findDoNotMergeIdentity(
  input: IdentityLockInput,
): CrcDoNotMergeIdentity | null {
  if (input.lockId) {
    const byId = CRC_DO_NOT_MERGE_IDENTITIES.find((row) => row.id === input.lockId);
    if (byId) return byId;
  }
  const name = normalizePersonName(input.firstName, input.lastName);
  if (!name) return null;
  return (
    CRC_DO_NOT_MERGE_IDENTITIES.find(
      (row) => normalizePersonName(row.firstName, row.lastName) === name,
    ) ?? null
  );
}

export function isDoNotMergeIdentity(input: IdentityLockInput): boolean {
  return findDoNotMergeIdentity(input) !== null;
}

export function isCharlesAolEmail(email?: string | null): boolean {
  if (!email?.trim()) return false;
  return normalizeEmail(email) === normalizeEmail(CRC_CHARLES_AOL_EMAIL);
}

export function isRefusedCreateIdentity(input: IdentityLockInput): boolean {
  return isCharlesAolEmail(input.email) || isDoNotMergeIdentity(input);
}

export type IdentityLockDecision = {
  skipMerge: boolean;
  refuseCreate: boolean;
  lockId?: string;
  reason: string;
};

export function decideIdentityLock(input: IdentityLockInput): IdentityLockDecision {
  if (isCharlesAolEmail(input.email)) {
    return {
      skipMerge: true,
      refuseCreate: true,
      lockId: "charles-aol-refused",
      reason: "Do not create charlesjgrant@aol.com. Owner/test collision — refuse create.",
    };
  }
  const locked = findDoNotMergeIdentity(input);
  if (locked) {
    return {
      skipMerge: true,
      refuseCreate: true,
      lockId: locked.id,
      reason: locked.reason,
    };
  }
  return {
    skipMerge: false,
    refuseCreate: false,
    reason: "No identity lock",
  };
}
