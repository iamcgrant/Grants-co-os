/**
 * Hard locks for CRC contact recovery. Encoded here so tests can assert them.
 * This PR is identify + tooling + dry-run only.
 */

import { DISPUTEFOX_ZAP_ENABLED, DISPUTEFOX_ZAP_ID } from "@/lib/integrations/disputefox/secrets";
import { DISPUTEFOX_CLIENT_WRITES_ENABLED } from "@/lib/integrations/disputefox/http";
import {
  GHL_CONTACT_WRITES_ENABLED,
  GHL_MESSAGE_WRITES_ENABLED,
  GHL_WORKFLOW_PUBLISH_ENABLED,
} from "@/lib/integrations/ghl/http";

export const CRC_RECOVERY_WRITES_ENV = "CRC_RECOVERY_WRITES_ENABLED";

export const CRC_MIGRATION_SOURCE = "CREDIT_REPAIR_CLOUD";

/** Recent-work window for RECENTLY_WORKED_TRANSITION_RISK (90 days). */
export const CRC_RECENT_WORK_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export const CRC_RECOVERY_LOCKS = {
  oneHumanOneMaster: true,
  searchOsGhlDfBeforeCreate: true,
  matchOrder: ["provider_id", "email", "phone", "name_and_address"] as const,
  doNotAutoCreateDisputeFox: true,
  backfillBlankOnly: true,
  neverOverwriteNewerVerified: true,
  doNotTreatAllCrcAsActive: true,
  fridayUpdateRouterPublished: false,
  zapId: DISPUTEFOX_ZAP_ID,
  zapEnabled: DISPUTEFOX_ZAP_ENABLED,
  phoneA2pSendaraFrozen: true,
  outboundSmsEmailIMessageEnabled: false,
  ghlContactWritesEnabled: GHL_CONTACT_WRITES_ENABLED,
  ghlMessageWritesEnabled: GHL_MESSAGE_WRITES_ENABLED,
  ghlWorkflowPublishEnabled: GHL_WORKFLOW_PUBLISH_ENABLED,
  disputeFoxClientWritesEnabled: DISPUTEFOX_CLIENT_WRITES_ENABLED,
  rawCrcFilesInGit: false,
  printPii: false,
} as const;

export const CRC_DO_NOT_ENROLL = {
  welcome: false,
  onboarding: false,
  poa: false,
  fridayPulse: false,
  invoices: false,
  paymentRequests: false,
  duplicateOpportunities: false,
  duplicateDfFiles: false,
} as const;

export function isCrcRecoveryWritesEnabled(): boolean {
  return process.env[CRC_RECOVERY_WRITES_ENV] === "true";
}
