import type { AddressParts } from "@/lib/clients/identity";
import type { CrcClientClassification } from "./classification";

export type VerifiedField<T> = {
  value: T | null;
  verified: boolean;
  verifiedAt?: string | null;
};

export type CrcAddress = AddressParts;

export type CrcDocumentRef = {
  /** Fixture / catalog id only — never raw file bytes. */
  id: string;
  crcClientId: string;
  documentType: string;
  originalDate: string;
  /** Pointer to secure storage. Never a GitHub path, never logged as content. */
  storageHint?: string;
  rawIncluded: false;
};

export type CrcExportClient = {
  crcClientId: string;
  grantsClientId?: string | null;
  ghlContactId?: string | null;
  disputeFoxClientId?: string | null;
  smartCreditId?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  phone?: string | null;
  phoneVerified?: boolean;
  phoneVerifiedAt?: string | null;
  address?: CrcAddress | null;
  addressVerified?: boolean;
  addressVerifiedAt?: string | null;
  status?: string | null;
  verifiedActive?: boolean;
  currentlyProcessing?: boolean;
  doNotReactivate?: boolean;
  lastWorkedAt?: string | null;
  lastReportAt?: string | null;
  lastDisputeAt?: string | null;
  documents?: CrcDocumentRef[];
};

export type CrcExportFile = {
  sourceSystem: "CREDIT_REPAIR_CLOUD";
  synthetic: true;
  exportedAt: string;
  clients: CrcExportClient[];
};

export type OsMasterRecord = {
  grantsClientId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  phone?: string | null;
  phoneVerified?: boolean;
  phoneVerifiedAt?: string | null;
  address?: CrcAddress | null;
  addressVerified?: boolean;
  addressVerifiedAt?: string | null;
  crcClientId?: string | null;
  ghlContactId?: string | null;
  disputeFoxClientId?: string | null;
  smartCreditId?: string | null;
};

export type GhlCatalogContact = {
  ghlContactId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: CrcAddress | null;
  grantsClientId?: string | null;
  crcClientId?: string | null;
  disputeFoxClientId?: string | null;
  smartCreditId?: string | null;
};

export type DfCatalogClient = {
  disputeFoxClientId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: CrcAddress | null;
  grantsClientId?: string | null;
  crcClientId?: string | null;
  ghlContactId?: string | null;
  smartCreditId?: string | null;
  started?: boolean;
  stage?: string | null;
};

export type IdentityCatalog = {
  osMasters: OsMasterRecord[];
  ghlContacts: GhlCatalogContact[];
  dfClients: DfCatalogClient[];
};

export type MatchBy = "provider_id" | "email" | "phone" | "name_and_address";

export type MatchHit<T> = {
  record: T;
  matchedBy: MatchBy;
  provider?: string;
};

export type SystemMatch<T> =
  | { status: "MATCHED"; hits: [MatchHit<T>, ...MatchHit<T>[]] }
  | { status: "MISSING" }
  | { status: "AMBIGUOUS"; hits: MatchHit<T>[]; reason: string };

export type CrcIdentityResolution = {
  crcClientId: string;
  classification: CrcClientClassification;
  os: SystemMatch<OsMasterRecord>;
  ghl: SystemMatch<GhlCatalogContact>;
  df: SystemMatch<DfCatalogClient>;
  unified: "MATCHED" | "MISSING" | "AMBIGUOUS";
  unifiedReason: string;
  grantsClientId?: string;
};

export type BackfillField = "email" | "phone" | "address";

export type BackfillDecision = {
  field: BackfillField;
  action: "FILL_BLANK" | "SKIP_ALREADY_PRESENT" | "SKIP_CRC_UNVERIFIED" | "CONFLICT_REVIEW";
  reason: string;
};

export type ProviderIdRecovery = {
  provider: string;
  externalId: string;
  action: "WOULD_ATTACH" | "ALREADY_PRESENT";
};

export type FutureCreateDecision = {
  createGrantsMaster: boolean;
  createGhlContact: boolean;
  createDisputeFox: false;
  reason: string;
};

export type DfTransitionDecision = {
  missingFromDf: boolean;
  autoCreateDisputeFox: false;
  flagForLaterDfCreateOrLink: boolean;
  reason: string;
};

export type CrcClientDecision = {
  crcClientId: string;
  classification: CrcClientClassification;
  resolution: CrcIdentityResolution;
  backfills: BackfillDecision[];
  providerIds: ProviderIdRecovery[];
  documents: CrcDocumentRef[];
  futureCreate: FutureCreateDecision;
  dfTransition: DfTransitionDecision;
  enroll: {
    welcome: false;
    onboarding: false;
    poa: false;
    fridayPulse: false;
    invoices: false;
    paymentRequests: false;
    duplicateOpportunities: false;
    duplicateDfFiles: false;
  };
  suggestedGhlTags: string[];
};

export type PublicReportRow = {
  crcClientId: string;
  grantsClientId?: string;
  classification?: CrcClientClassification;
  matchedBy?: MatchBy;
  reason: string;
};
