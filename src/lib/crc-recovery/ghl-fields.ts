/**
 * GHL organization fields for CRC recovery.
 * Document + schema only. Do not live-write GHL. Do not apply tags live.
 */

import { GHL_SERVICE_STATUS_VALUES } from "@/lib/integrations/crc/service-status";
import { CrcClientClassification } from "./classification";
import { CRC_MIGRATION_SOURCE } from "./locks";

export const GHL_CRC_CUSTOM_FIELDS = [
  { key: "grants_client_id", label: "Grants Client ID", type: "text" },
  { key: "crc_client_id", label: "CRC Client ID", type: "text" },
  { key: "disputefox_client_id", label: "DisputeFox Client ID", type: "text" },
  {
    key: "service_status",
    label: "Service Status",
    type: "enum",
    values: GHL_SERVICE_STATUS_VALUES,
  },
  { key: "last_worked_date", label: "Last Worked Date", type: "date" },
  { key: "last_report_date", label: "Last Report Date", type: "date" },
  { key: "last_dispute_date", label: "Last Dispute Date", type: "date" },
  {
    key: "migration_source",
    label: "Migration Source",
    type: "text",
    constant: CRC_MIGRATION_SOURCE,
  },
] as const;

export const GHL_CRC_SUGGESTED_TAGS = [
  "legacy-crc-client",
  "crc-transition-recovered",
  "credit-client-active",
  "credit-client-dormant",
  "reactivation-eligible",
  "transition-review",
] as const;

export type GhlCrcSuggestedTag = (typeof GHL_CRC_SUGGESTED_TAGS)[number];

export function suggestedGhlTagsFor(
  classification: CrcClientClassification,
  options?: { recovered?: boolean },
): GhlCrcSuggestedTag[] {
  const tags: GhlCrcSuggestedTag[] = ["legacy-crc-client"];
  if (options?.recovered) tags.push("crc-transition-recovered");

  if (classification === CrcClientClassification.VERIFIED_ACTIVE) {
    tags.push("credit-client-active");
  } else if (classification === CrcClientClassification.DORMANT_REACTIVATION_ELIGIBLE) {
    tags.push("credit-client-dormant", "reactivation-eligible");
  } else if (classification === CrcClientClassification.RECENTLY_WORKED_TRANSITION_RISK) {
    tags.push("transition-review");
  }
  return tags;
}

export type GhlCrcFieldValues = {
  grants_client_id?: string;
  crc_client_id: string;
  disputefox_client_id?: string;
  service_status?: string;
  last_worked_date?: string;
  last_report_date?: string;
  last_dispute_date?: string;
  migration_source: typeof CRC_MIGRATION_SOURCE;
};

export function buildGhlCrcFieldValues(input: {
  crcClientId: string;
  grantsClientId?: string;
  disputeFoxClientId?: string;
  serviceStatus?: string;
  lastWorkedAt?: string | null;
  lastReportAt?: string | null;
  lastDisputeAt?: string | null;
}): GhlCrcFieldValues {
  return {
    grants_client_id: input.grantsClientId,
    crc_client_id: input.crcClientId,
    disputefox_client_id: input.disputeFoxClientId,
    service_status: input.serviceStatus,
    last_worked_date: input.lastWorkedAt ?? undefined,
    last_report_date: input.lastReportAt ?? undefined,
    last_dispute_date: input.lastDisputeAt ?? undefined,
    migration_source: CRC_MIGRATION_SOURCE,
  };
}
