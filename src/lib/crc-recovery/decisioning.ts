/**
 * CRC recovery decisioning. Does not execute live creates or writes.
 *
 * Future path when a legitimate CRC client is in neither Grants OS nor GHL:
 * ONE Grants master + ONE GHL contact. Never a second master. Never auto-create DF.
 */

import { CLIENT_IDENTIFIER_PROVIDER, collectProviderIds } from "@/lib/clients/identifiers";
import { decideBackfills } from "./backfill";
import { classifyCrcClient, isDfCreateCandidate } from "./classification";
import { suggestedGhlTagsFor } from "./ghl-fields";
import { CRC_DO_NOT_ENROLL } from "./locks";
import { resolveCrcIdentity } from "./match";
import type {
  CrcClientDecision,
  CrcExportClient,
  DfTransitionDecision,
  FutureCreateDecision,
  IdentityCatalog,
  OsMasterRecord,
  ProviderIdRecovery,
} from "./types";

function osMasterFrom(decision: CrcClientDecision["resolution"]): OsMasterRecord | null {
  if (decision.os.status === "MATCHED") return decision.os.hits[0].record;
  return null;
}

function providerIdRecoveries(crc: CrcExportClient, os: OsMasterRecord | null): ProviderIdRecovery[] {
  const crcIds = collectProviderIds({
    grantsClientId: crc.grantsClientId,
    ghlContactId: crc.ghlContactId,
    disputeFoxClientId: crc.disputeFoxClientId,
    crcClientId: crc.crcClientId,
    smartCreditId: crc.smartCreditId,
  });
  const osIds = new Set(
    collectProviderIds({
      grantsClientId: os?.grantsClientId,
      ghlContactId: os?.ghlContactId,
      disputeFoxClientId: os?.disputeFoxClientId,
      crcClientId: os?.crcClientId,
      smartCreditId: os?.smartCreditId,
    }).map((id) => `${id.provider}:${id.externalId}`),
  );

  return crcIds
    .filter((id) => id.provider !== "GRANTS")
    .map((id) => ({
      provider: id.provider,
      externalId: id.externalId,
      action: osIds.has(`${id.provider}:${id.externalId}`)
        ? ("ALREADY_PRESENT" as const)
        : ("WOULD_ATTACH" as const),
    }));
}

function futureCreate(resolution: CrcClientDecision["resolution"]): FutureCreateDecision {
  if (resolution.unified === "AMBIGUOUS") {
    return {
      createGrantsMaster: false,
      createGhlContact: false,
      createDisputeFox: false,
      reason: "Ambiguous identity — review queue, no create",
    };
  }
  if (resolution.os.status === "MATCHED") {
    return {
      createGrantsMaster: false,
      createGhlContact: resolution.ghl.status === "MISSING",
      createDisputeFox: false,
      reason:
        resolution.ghl.status === "MISSING"
          ? "Existing Grants master — future path is one GHL contact on that master, no second OS client, no DF auto-create"
          : "Existing Grants master and GHL contact — attach CRC identifiers only",
    };
  }
  if (resolution.ghl.status === "MATCHED") {
    return {
      createGrantsMaster: true,
      createGhlContact: false,
      createDisputeFox: false,
      reason: "Existing GHL contact — future path is one Grants master linked to that contact, no second GHL row, no DF auto-create",
    };
  }
  return {
    createGrantsMaster: true,
    createGhlContact: true,
    createDisputeFox: false,
    reason: "Missing from Grants OS and GHL — future path is one Grants master + one GHL contact. Do not auto-create DisputeFox.",
  };
}

function dfTransition(
  resolution: CrcClientDecision["resolution"],
  classification: CrcClientDecision["classification"],
): DfTransitionDecision {
  const missingFromDf = resolution.df.status === "MISSING";
  if (!missingFromDf) {
    return {
      missingFromDf: false,
      autoCreateDisputeFox: false,
      flagForLaterDfCreateOrLink: false,
      reason: "DisputeFox record already present — do not create another file",
    };
  }
  if (isDfCreateCandidate(classification) && resolution.unified !== "AMBIGUOUS") {
    return {
      missingFromDf: true,
      autoCreateDisputeFox: false,
      flagForLaterDfCreateOrLink: true,
      reason:
        "Verified active or recently worked — flag for later DF create/link. This PR does not auto-create DisputeFox.",
    };
  }
  return {
    missingFromDf: true,
    autoCreateDisputeFox: false,
    flagForLaterDfCreateOrLink: false,
    reason:
      "Dormant or closed former client — stay Grants OS + GHL for reactivation. Do not auto-create DisputeFox.",
  };
}

export function decideCrcClient(crc: CrcExportClient, catalog: IdentityCatalog, nowMs = Date.now()): CrcClientDecision {
  const classification = classifyCrcClient(crc, nowMs);
  const resolution = resolveCrcIdentity(crc, catalog, classification);
  const os = osMasterFrom(resolution);
  const recovered = resolution.unified === "MATCHED";

  return {
    crcClientId: crc.crcClientId,
    classification,
    resolution,
    backfills: decideBackfills(os, crc),
    providerIds: providerIdRecoveries(crc, os),
    documents: (crc.documents || []).map((d) => ({ ...d, rawIncluded: false as const })),
    futureCreate: futureCreate(resolution),
    dfTransition: dfTransition(resolution, classification),
    enroll: { ...CRC_DO_NOT_ENROLL },
    suggestedGhlTags: suggestedGhlTagsFor(classification, { recovered }),
  };
}

export function decideCrcExport(clients: CrcExportClient[], catalog: IdentityCatalog, nowMs = Date.now()) {
  return clients.map((c) => decideCrcClient(c, catalog, nowMs));
}

export function wouldCreateDuplicateMaster(decision: CrcClientDecision): boolean {
  return decision.resolution.os.status === "MATCHED" && decision.futureCreate.createGrantsMaster;
}

export function wouldAutoCreateDisputeFox(decision: CrcClientDecision): boolean {
  return decision.dfTransition.autoCreateDisputeFox === true || decision.futureCreate.createDisputeFox === true;
}

export { CLIENT_IDENTIFIER_PROVIDER };
