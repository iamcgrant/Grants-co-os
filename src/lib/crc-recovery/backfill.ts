/**
 * Backfill only when the new-system field is blank and CRC has a verified value.
 * Never overwrite newer verified data with older CRC. Conflicts → review queue.
 */

import { normalizeAddressKey, normalizeEmail, normalizePhone } from "@/lib/clients/identity";
import type { BackfillDecision, BackfillField, CrcExportClient, OsMasterRecord } from "./types";

function comparable(field: BackfillField, value: string | null | undefined, address?: OsMasterRecord["address"]) {
  if (field === "email") return value?.trim() ? normalizeEmail(value) : null;
  if (field === "phone") return normalizePhone(value);
  return normalizeAddressKey(address);
}

function fieldState(
  field: BackfillField,
  source: {
    email?: string | null;
    emailVerified?: boolean;
    emailVerifiedAt?: string | null;
    phone?: string | null;
    phoneVerified?: boolean;
    phoneVerifiedAt?: string | null;
    address?: OsMasterRecord["address"];
    addressVerified?: boolean;
    addressVerifiedAt?: string | null;
  },
) {
  if (field === "email") {
    return {
      raw: source.email ?? null,
      key: comparable("email", source.email),
      verified: Boolean(source.emailVerified && source.email?.trim()),
      verifiedAt: source.emailVerifiedAt ?? null,
    };
  }
  if (field === "phone") {
    return {
      raw: source.phone ?? null,
      key: comparable("phone", source.phone),
      verified: Boolean(source.phoneVerified && normalizePhone(source.phone)),
      verifiedAt: source.phoneVerifiedAt ?? null,
    };
  }
  return {
    raw: source.address ? JSON.stringify(source.address) : null,
    key: comparable("address", null, source.address),
    verified: Boolean(source.addressVerified && normalizeAddressKey(source.address)),
    verifiedAt: source.addressVerifiedAt ?? null,
  };
}

export function decideFieldBackfill(
  field: BackfillField,
  os: OsMasterRecord | null,
  crc: CrcExportClient,
): BackfillDecision {
  const crcState = fieldState(field, crc);
  if (!crcState.key || !crcState.verified) {
    return { field, action: "SKIP_CRC_UNVERIFIED", reason: "CRC has no verified value for this field" };
  }

  if (!os) {
    return {
      field,
      action: "FILL_BLANK",
      reason: "No Grants OS master yet — verified CRC value is a blank-fill candidate on future create",
    };
  }

  const osState = fieldState(field, os);
  if (!osState.key) {
    return {
      field,
      action: "FILL_BLANK",
      reason: "New-system field is blank and CRC has a verified value",
    };
  }

  if (osState.key === crcState.key) {
    return { field, action: "SKIP_ALREADY_PRESENT", reason: "New-system field already matches CRC" };
  }

  const osAt = osState.verifiedAt ? Date.parse(osState.verifiedAt) : NaN;
  const crcAt = crcState.verifiedAt ? Date.parse(crcState.verifiedAt) : NaN;
  const osIsNewerVerified =
    osState.verified && (!Number.isNaN(osAt) && !Number.isNaN(crcAt) ? osAt >= crcAt : osState.verified);

  if (osIsNewerVerified || osState.verified) {
    return {
      field,
      action: "CONFLICT_REVIEW",
      reason: "Newer or existing verified OS value differs from CRC — do not overwrite",
    };
  }

  return {
    field,
    action: "CONFLICT_REVIEW",
    reason: "Both sides have values that differ — review queue, no automatic overwrite",
  };
}

export function decideBackfills(os: OsMasterRecord | null, crc: CrcExportClient): BackfillDecision[] {
  return (["email", "phone", "address"] as BackfillField[]).map((field) =>
    decideFieldBackfill(field, os, crc),
  );
}
