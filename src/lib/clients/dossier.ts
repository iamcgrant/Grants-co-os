/**
 * Client 360 integration surface — real IDs when synced, otherwise Awaiting Integration.
 */

import {
  getGcEnvironment,
  isLiveSyncedIdentifier,
  isSeedIdentifier,
  parseIdentifierMeta,
} from "@/lib/integrations/env";
import { integrationCredentialStatus } from "@/lib/integrations/credentials";
import { isGhlApiReady } from "@/lib/integrations/ghl/http";

export type IntegrationFieldState =
  | { state: "LIVE"; value: string; detail?: string }
  | { state: "DEV_SAMPLE"; value: string; detail?: string }
  | { state: "AWAITING_INTEGRATION"; value: null; detail?: string }
  | { state: "UNMATCHED"; value: string | null; detail?: string };

export type ClientDossierIntegrations = {
  dataPlane: "development" | "production";
  ghlApiReady: boolean;
  grantsClientId: string;
  ghlContactId: IntegrationFieldState;
  disputeFoxClientId: IntegrationFieldState;
  intakeStatus: IntegrationFieldState;
  credit: IntegrationFieldState;
  payments: IntegrationFieldState;
  ghlMessages: IntegrationFieldState;
  credentialFlags: ReturnType<typeof integrationCredentialStatus>;
};

type Ident = { provider: string; externalId: string; metadataJson: string | null };

function fieldFromIdentifier(
  ident: Ident | undefined,
  liveReady: boolean,
): IntegrationFieldState {
  if (!ident) {
    return {
      state: liveReady ? "UNMATCHED" : "AWAITING_INTEGRATION",
      value: null,
      detail: liveReady
        ? "No matched external ID on this Grants Client yet"
        : "Awaiting Integration",
    };
  }
  if (isLiveSyncedIdentifier(ident.metadataJson)) {
    const meta = parseIdentifierMeta(ident.metadataJson);
    return {
      state: "LIVE",
      value: ident.externalId,
      detail: meta.syncedAt ? `Synced ${meta.syncedAt}` : "Live sync",
    };
  }
  if (isSeedIdentifier(ident.metadataJson) && getGcEnvironment() === "development") {
    return {
      state: "DEV_SAMPLE",
      value: ident.externalId,
      detail: "Development sample — not live CRM data",
    };
  }
  // Production with non-live id, or unknown
  if (!liveReady) {
    return {
      state: "AWAITING_INTEGRATION",
      value: null,
      detail: "Awaiting Integration",
    };
  }
  return {
    state: "UNMATCHED",
    value: ident.externalId,
    detail: "Identifier on file but not confirmed via live sync",
  };
}

export function buildClientDossierIntegrations(input: {
  grantsClientId: string;
  identifiers: Ident[];
  stage?: string;
  hasCreditScores: boolean;
  hasPaymentRecords: boolean;
  creditConnectionStatuses: { provider: string; status: string }[];
}): ClientDossierIntegrations {
  const flags = integrationCredentialStatus();
  const ghlReady = isGhlApiReady();
  const dfReady = flags.disputeFoxApi;

  const ghl = input.identifiers.find((i) => i.provider === "GHL");
  const df = input.identifiers.find((i) => i.provider === "DISPUTEFOX");

  // Intake Status — OS stage is source of truth; GHL field key intake_status maps here.
  const stageLabel = (input.stage || "NEW_ENROLLMENT").replaceAll("_", " ");
  const intakeStatus: IntegrationFieldState = ghlReady
    ? {
        state: ghl && isLiveSyncedIdentifier(ghl.metadataJson) ? "LIVE" : "UNMATCHED",
        value: stageLabel,
        detail: "Mapped from Client.stage · GHL field key `intake_status`",
      }
    : input.stage
      ? {
          state: "DEV_SAMPLE",
          value: stageLabel,
          detail: "OS stage on file · GHL intake_status sync Awaiting Integration",
        }
      : {
          state: "AWAITING_INTEGRATION",
          value: null,
          detail: "Awaiting Integration",
        };

  const liveCredit = input.creditConnectionStatuses.some(
    (c) => c.status === "CONNECTED" && !c.provider.startsWith("MOCK"),
  );
  // Seed credit in development is DEV_SAMPLE; otherwise awaiting
  let credit: IntegrationFieldState;
  if (liveCredit && input.hasCreditScores && getGcEnvironment() === "production") {
    credit = { state: "LIVE", value: "Connected", detail: "Live credit data on file" };
  } else if (input.hasCreditScores && getGcEnvironment() === "development") {
    credit = {
      state: "DEV_SAMPLE",
      value: "Sample scores",
      detail: "Development sample — SmartCredit/live bureaus not connected",
    };
  } else if (flags.smartCreditSponsor && !input.hasCreditScores) {
    credit = {
      state: "UNMATCHED",
      value: null,
      detail: "Sponsor link ready — no scores synced for this client",
    };
  } else {
    credit = {
      state: "AWAITING_INTEGRATION",
      value: null,
      detail: "Awaiting Integration",
    };
  }

  let payments: IntegrationFieldState;
  if (input.hasPaymentRecords && getGcEnvironment() === "development") {
    payments = {
      state: "DEV_SAMPLE",
      value: "Sample ledger",
      detail: "Development sample — live Authorize.Net/Commas not charging",
    };
  } else if (input.hasPaymentRecords) {
    payments = { state: "LIVE", value: "On file", detail: "Payment records present" };
  } else {
    payments = {
      state: "AWAITING_INTEGRATION",
      value: null,
      detail: "Awaiting Integration — no payment records yet",
    };
  }

  // Never surface mock GHL messages as real communication history
  const ghlLinked = fieldFromIdentifier(ghl, true);
  const ghlMessages: IntegrationFieldState = ghlReady
    ? ghlLinked.state === "LIVE"
      ? {
          state: "LIVE",
          value: "Linked",
          detail: "GHL SMS/email desk available in Inbox and Client 360",
        }
      : {
          state: "UNMATCHED",
          value: null,
          detail: "GHL SMS/email desk available in Inbox and Client 360",
        }
    : {
        state: "AWAITING_INTEGRATION",
        value: null,
        detail: "Awaiting Integration — GHL API not connected",
      };

  return {
    dataPlane: getGcEnvironment(),
    ghlApiReady: ghlReady,
    grantsClientId: input.grantsClientId,
    ghlContactId: fieldFromIdentifier(ghl, ghlReady),
    disputeFoxClientId: fieldFromIdentifier(df, dfReady),
    intakeStatus,
    credit,
    payments,
    ghlMessages,
    credentialFlags: flags,
  };
}

export function formatIntegrationField(field: IntegrationFieldState): string {
  if (field.state === "AWAITING_INTEGRATION") return "Awaiting Integration";
  if (field.state === "UNMATCHED") return field.value || "Not matched";
  if (field.state === "DEV_SAMPLE") return field.value ? `${field.value} (dev sample)` : "Dev sample";
  return field.value || "—";
}
