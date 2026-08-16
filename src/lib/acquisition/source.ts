/**
 * AcquisitionSource parse — missing is unknown, never organic.
 * Campaign/content stamps stay on LeadAttribution (PR #12).
 */

import type { AttributionSource } from "@/generated/prisma/client";
import {
  ACQUISITION_SOURCES,
  AcquisitionError,
  type AcquisitionSourceValue,
} from "./types";

export function isAcquisitionSource(value: string): value is AcquisitionSourceValue {
  return (ACQUISITION_SOURCES as readonly string[]).includes(value);
}

/**
 * Fail-closed source parse.
 * Blank/missing → null (unknown). Never coerced to ORGANIC.
 * Explicit ORGANIC is allowed only when stamped.
 */
export function parseAcquisitionSource(
  raw: string | null | undefined,
  options: { required?: boolean } = {},
): AcquisitionSourceValue | null {
  if (raw == null || String(raw).trim() === "") {
    if (options.required) {
      throw new AcquisitionError(
        "SOURCE_REQUIRED",
        "Acquisition source is required, or must be stored as unknown. Missing is not organic.",
      );
    }
    return null;
  }

  const normalized = String(raw).trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!isAcquisitionSource(normalized)) {
    throw new AcquisitionError(
      "INVALID_SOURCE",
      `Source '${raw}' is not in the AcquisitionSource allow-list. Missing stamp is unknown, not organic.`,
    );
  }
  return normalized;
}

/** Map command-center source onto existing AttributionSource. organic is not an AttributionSource. */
export function mapAcquisitionSourceToAttribution(
  source: AcquisitionSourceValue | null | undefined,
): AttributionSource {
  switch (source) {
    case "FACEBOOK":
      return "facebook";
    case "INSTAGRAM":
      return "instagram";
    case "EMAIL_CAMPAIGN":
      return "email";
    case "REALTOR_PARTNER":
    case "MORTGAGE_PARTNER":
    case "BUILDER_PARTNER":
    case "FORMER_CLIENT_REFERRAL":
      return "referral";
    default:
      return "unknown";
  }
}
