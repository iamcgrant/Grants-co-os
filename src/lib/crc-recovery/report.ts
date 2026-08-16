/**
 * CRC → DISPUTEFOX TRANSITION RECOVERY REPORT
 * Public output uses CRC / Grants IDs only — no names, emails, phones, or addresses.
 */

import { CrcClientClassification } from "./classification";
import { decideCrcExport } from "./decisioning";
import { publicDocumentRow } from "./documents";
import { CRC_DO_NOT_ENROLL, CRC_RECOVERY_LOCKS, isCrcRecoveryWritesEnabled } from "./locks";
import type {
  CrcClientDecision,
  CrcExportClient,
  IdentityCatalog,
  MatchBy,
  PublicReportRow,
} from "./types";

export const CRC_RECOVERY_REPORT_TITLE = "CRC → DISPUTEFOX TRANSITION RECOVERY REPORT";

export type ReportSection = {
  key: string;
  title: string;
  count: number;
  rows: PublicReportRow[];
};

export type CrcRecoveryReport = {
  title: typeof CRC_RECOVERY_REPORT_TITLE;
  generatedAt: string;
  mode: "dry-run";
  writesEnabled: boolean;
  liveSideEffects: {
    ghlCreates: 0;
    ghlWrites: 0;
    dfCreates: 0;
    dfWrites: 0;
    osCreates: 0;
    messagesSent: 0;
    workflowsPublished: 0;
    enrollments: 0;
  };
  locks: typeof CRC_RECOVERY_LOCKS;
  enroll: typeof CRC_DO_NOT_ENROLL;
  catalogCounts: { osMasters: number; ghlContacts: number; dfClients: number; crcClients: number };
  classifications: Record<CrcClientClassification, number>;
  sections: {
    crcMissingFromGrantsOs: ReportSection;
    crcMissingFromGhl: ReportSection;
    crcMissingFromDisputeFox: ReportSection;
    recoveredContactsCreatedInGhl: ReportSection;
    missingContactFieldsRecovered: ReportSection;
    missingProviderIdsRecovered: ReportSection;
    documentsReportsRecovered: ReportSection;
    recentlyWorkedNotTransitionedToDf: ReportSection;
    ambiguousIdentitiesRequiringReview: ReportSection;
  };
  reviewQueue: PublicReportRow[];
};

function row(
  decision: CrcClientDecision,
  reason: string,
  matchedBy?: MatchBy,
): PublicReportRow {
  return {
    crcClientId: decision.crcClientId,
    grantsClientId: decision.resolution.grantsClientId,
    classification: decision.classification,
    matchedBy,
    reason,
  };
}

function emptySection(key: string, title: string): ReportSection {
  return { key, title, count: 0, rows: [] };
}

function countClassifications(decisions: CrcClientDecision[]) {
  const counts: Record<CrcClientClassification, number> = {
    [CrcClientClassification.VERIFIED_ACTIVE]: 0,
    [CrcClientClassification.RECENTLY_WORKED_TRANSITION_RISK]: 0,
    [CrcClientClassification.DORMANT_REACTIVATION_ELIGIBLE]: 0,
    [CrcClientClassification.CLOSED_DO_NOT_REACTIVATE]: 0,
  };
  for (const d of decisions) counts[d.classification] += 1;
  return counts;
}

export function buildCrcRecoveryReport(input: {
  crcClients: CrcExportClient[];
  catalog: IdentityCatalog;
  nowMs?: number;
  generatedAt?: string;
}): CrcRecoveryReport {
  const decisions = decideCrcExport(input.crcClients, input.catalog, input.nowMs);

  const crcMissingFromGrantsOs = emptySection(
    "crc_missing_from_grants_os",
    "CRC clients completely missing from Grants OS",
  );
  const crcMissingFromGhl = emptySection(
    "crc_missing_from_ghl",
    "CRC clients completely missing from GHL",
  );
  const crcMissingFromDisputeFox = emptySection(
    "crc_missing_from_disputefox",
    "CRC clients missing from DisputeFox",
  );
  const recoveredContactsCreatedInGhl = emptySection(
    "recovered_contacts_created_in_ghl",
    "Recovered contacts created in GHL",
  );
  const missingContactFieldsRecovered = emptySection(
    "missing_contact_fields_recovered",
    "Missing email/phone/address recovered",
  );
  const missingProviderIdsRecovered = emptySection(
    "missing_provider_ids_recovered",
    "Missing provider IDs recovered",
  );
  const documentsReportsRecovered = emptySection(
    "documents_reports_recovered",
    "Documents/reports recovered",
  );
  const recentlyWorkedNotTransitionedToDf = emptySection(
    "recently_worked_not_transitioned_to_df",
    "Recently worked CRC clients not properly transitioned to DF",
  );
  const ambiguousIdentitiesRequiringReview = emptySection(
    "ambiguous_identities_requiring_review",
    "Ambiguous identities requiring review",
  );

  const reviewQueue: PublicReportRow[] = [];

  for (const decision of decisions) {
    const osMatchBy =
      decision.resolution.os.status === "MATCHED"
        ? decision.resolution.os.hits[0].matchedBy
        : undefined;

    if (decision.resolution.os.status === "MISSING" && decision.resolution.unified !== "AMBIGUOUS") {
      crcMissingFromGrantsOs.rows.push(
        row(decision, "No Grants OS master matched provider ID, email, phone, or name+address", osMatchBy),
      );
    }
    if (decision.resolution.ghl.status === "MISSING" && decision.resolution.unified !== "AMBIGUOUS") {
      crcMissingFromGhl.rows.push(row(decision, "No GHL contact matched", osMatchBy));
    }
    if (decision.resolution.df.status === "MISSING" && decision.resolution.unified !== "AMBIGUOUS") {
      crcMissingFromDisputeFox.rows.push(row(decision, "No DisputeFox record matched", osMatchBy));
    }

    // Dry-run never creates GHL contacts.
    void decision.futureCreate.createGhlContact;

    for (const fill of decision.backfills) {
      if (fill.action === "FILL_BLANK") {
        missingContactFieldsRecovered.rows.push(
          row(decision, `Blank-fill candidate: ${fill.field} — ${fill.reason}`, osMatchBy),
        );
      }
      if (fill.action === "CONFLICT_REVIEW") {
        reviewQueue.push(row(decision, `Field conflict: ${fill.field} — ${fill.reason}`, osMatchBy));
      }
    }

    for (const id of decision.providerIds) {
      if (id.action === "WOULD_ATTACH") {
        missingProviderIdsRecovered.rows.push(
          row(decision, `Would attach ${id.provider} identifier on the master`, osMatchBy),
        );
      }
    }

    for (const doc of decision.documents) {
      const pub = publicDocumentRow(doc);
      documentsReportsRecovered.rows.push(
        row(
          decision,
          `Would recover ${pub.documentType} metadata (sourceSystem=${pub.sourceSystem}, originalDate=${pub.originalDate})`,
          osMatchBy,
        ),
      );
    }

    if (decision.dfTransition.flagForLaterDfCreateOrLink) {
      recentlyWorkedNotTransitionedToDf.rows.push(
        row(decision, decision.dfTransition.reason, osMatchBy),
      );
    }

    if (decision.resolution.unified === "AMBIGUOUS") {
      const amb = row(decision, decision.resolution.unifiedReason, osMatchBy);
      ambiguousIdentitiesRequiringReview.rows.push(amb);
      reviewQueue.push(amb);
    }
  }

  const sections = {
    crcMissingFromGrantsOs,
    crcMissingFromGhl,
    crcMissingFromDisputeFox,
    recoveredContactsCreatedInGhl,
    missingContactFieldsRecovered,
    missingProviderIdsRecovered,
    documentsReportsRecovered,
    recentlyWorkedNotTransitionedToDf,
    ambiguousIdentitiesRequiringReview,
  };

  for (const section of Object.values(sections)) {
    section.count = section.rows.length;
  }

  return {
    title: CRC_RECOVERY_REPORT_TITLE,
    generatedAt: input.generatedAt || new Date().toISOString(),
    mode: "dry-run",
    writesEnabled: isCrcRecoveryWritesEnabled(),
    liveSideEffects: {
      ghlCreates: 0,
      ghlWrites: 0,
      dfCreates: 0,
      dfWrites: 0,
      osCreates: 0,
      messagesSent: 0,
      workflowsPublished: 0,
      enrollments: 0,
    },
    locks: CRC_RECOVERY_LOCKS,
    enroll: CRC_DO_NOT_ENROLL,
    catalogCounts: {
      osMasters: input.catalog.osMasters.length,
      ghlContacts: input.catalog.ghlContacts.length,
      dfClients: input.catalog.dfClients.length,
      crcClients: input.crcClients.length,
    },
    classifications: countClassifications(decisions),
    sections,
    reviewQueue,
  };
}

export function reportSectionTitles(report: CrcRecoveryReport): string[] {
  return Object.values(report.sections).map((s) => s.title);
}
