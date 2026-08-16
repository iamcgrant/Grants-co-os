import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CONFIRMED_MASTERS } from "../src/lib/clients/confirmed-masters";
import { CONFIRMED_DF_ROSTER } from "../src/lib/integrations/disputefox/roster";
import { CLIENT_IDENTIFIER_PROVIDER } from "../src/lib/clients/identifiers";
import { normalizeEmail, normalizePhone } from "../src/lib/clients/identity";
import {
  CrcClientClassification,
  classifyCrcClient,
  decideCrcClient,
  decideCrcExport,
  wouldAutoCreateDisputeFox,
  wouldCreateDuplicateMaster,
  decideFieldBackfill,
  matchOs,
  resolveCrcIdentity,
  buildCrcRecoveryReport,
  reportSectionTitles,
  CRC_RECOVERY_REPORT_TITLE,
  CRC_RECOVERY_LOCKS,
  CRC_RECOVERY_WRITES_ENV,
  CRC_MIGRATION_SOURCE,
  GHL_CRC_CUSTOM_FIELDS,
  GHL_CRC_SUGGESTED_TAGS,
  applyCrcRecoveryDecisions,
  assertCrcRecoveryWriteAllowed,
  projectConfirmedMastersToOsCatalog,
  projectConfirmedDfRosterToDfCatalog,
  SYNTHETIC_CRC_EXPORT,
  SYNTHETIC_NOW_MS,
  syntheticCatalog,
  loadCrcExport,
  parseCrcExport,
} from "../src/lib/crc-recovery";
import { defaultFixturePaths } from "../src/lib/crc-recovery/load";

const NOW = SYNTHETIC_NOW_MS;

function crcById(id: string) {
  const row = SYNTHETIC_CRC_EXPORT.clients.find((c) => c.crcClientId === id);
  if (!row) throw new Error(`missing fixture ${id}`);
  return row;
}

describe("CRC contact recovery — identify + dry-run", () => {
  const prevWrites = process.env[CRC_RECOVERY_WRITES_ENV];

  beforeEach(() => {
    delete process.env[CRC_RECOVERY_WRITES_ENV];
  });

  afterEach(() => {
    if (prevWrites === undefined) delete process.env[CRC_RECOVERY_WRITES_ENV];
    else process.env[CRC_RECOVERY_WRITES_ENV] = prevWrites;
  });

  it("encodes hard locks and GHL organization schema without live writes", () => {
    expect(CRC_RECOVERY_LOCKS.oneHumanOneMaster).toBe(true);
    expect(CRC_RECOVERY_LOCKS.searchOsGhlDfBeforeCreate).toBe(true);
    expect(CRC_RECOVERY_LOCKS.matchOrder).toEqual([
      "provider_id",
      "email",
      "phone",
      "name_and_address",
    ]);
    expect(CRC_RECOVERY_LOCKS.doNotAutoCreateDisputeFox).toBe(true);
    expect(CRC_RECOVERY_LOCKS.backfillBlankOnly).toBe(true);
    expect(CRC_RECOVERY_LOCKS.neverOverwriteNewerVerified).toBe(true);
    expect(CRC_RECOVERY_LOCKS.doNotTreatAllCrcAsActive).toBe(true);
    expect(CRC_RECOVERY_LOCKS.fridayUpdateRouterPublished).toBe(false);
    expect(CRC_RECOVERY_LOCKS.zapId).toBe("374413762");
    expect(CRC_RECOVERY_LOCKS.zapEnabled).toBe(false);
    expect(CRC_RECOVERY_LOCKS.phoneA2pSendaraFrozen).toBe(true);
    expect(CRC_RECOVERY_LOCKS.outboundSmsEmailIMessageEnabled).toBe(false);
    expect(CRC_RECOVERY_LOCKS.ghlContactWritesEnabled).toBe(false);
    expect(CRC_RECOVERY_LOCKS.disputeFoxClientWritesEnabled).toBe(false);
    expect(CRC_MIGRATION_SOURCE).toBe("CREDIT_REPAIR_CLOUD");
    expect(GHL_CRC_CUSTOM_FIELDS.map((f) => f.label)).toEqual([
      "Grants Client ID",
      "CRC Client ID",
      "DisputeFox Client ID",
      "Service Status",
      "Last Worked Date",
      "Last Report Date",
      "Last Dispute Date",
      "Migration Source",
    ]);
    expect([...GHL_CRC_SUGGESTED_TAGS]).toEqual([
      "legacy-crc-client",
      "crc-transition-recovered",
      "credit-client-active",
      "credit-client-dormant",
      "reactivation-eligible",
      "transition-review",
    ]);
    expect(CLIENT_IDENTIFIER_PROVIDER.CREDIT_REPAIR_CLOUD).toBe("CREDIT_REPAIR_CLOUD");
    expect(CLIENT_IDENTIFIER_PROVIDER.GHL).toBe("GHL");
    expect(CLIENT_IDENTIFIER_PROVIDER.DISPUTEFOX).toBe("DISPUTEFOX");
    expect(CLIENT_IDENTIFIER_PROVIDER.SMARTCREDIT).toBe("SMARTCREDIT");
  });

  it("classifies after identity recovery and does not treat all CRC as active", () => {
    expect(classifyCrcClient(crcById("CRC-SYN-1001"), NOW)).toBe(
      CrcClientClassification.VERIFIED_ACTIVE,
    );
    expect(classifyCrcClient(crcById("CRC-SYN-1003"), NOW)).toBe(
      CrcClientClassification.RECENTLY_WORKED_TRANSITION_RISK,
    );
    expect(classifyCrcClient(crcById("CRC-SYN-1002"), NOW)).toBe(
      CrcClientClassification.DORMANT_REACTIVATION_ELIGIBLE,
    );
    expect(classifyCrcClient(crcById("CRC-SYN-1008"), NOW)).toBe(
      CrcClientClassification.CLOSED_DO_NOT_REACTIVATE,
    );
    expect(
      classifyCrcClient({ status: "active", lastWorkedAt: "2022-01-01T00:00:00.000Z" }, NOW),
    ).toBe(CrcClientClassification.DORMANT_REACTIVATION_ELIGIBLE);
  });

  it("matches provider IDs before email before phone before name+address", () => {
    const catalog = syntheticCatalog();
    const byCrcId = matchOs(crcById("CRC-SYN-1014"), catalog.osMasters);
    expect(byCrcId.status).toBe("MATCHED");
    if (byCrcId.status === "MATCHED") {
      expect(byCrcId.hits[0].matchedBy).toBe("provider_id");
      expect(byCrcId.hits[0].record.grantsClientId).toBe("GC-SYN-000014");
    }

    const byEmail = matchOs(crcById("CRC-SYN-1002"), catalog.osMasters);
    expect(byEmail.status).toBe("MATCHED");
    if (byEmail.status === "MATCHED") expect(byEmail.hits[0].matchedBy).toBe("email");

    const phoneOnly = {
      ...crcById("CRC-SYN-1003"),
      email: "casey.ortiz.other@example.test",
      ghlContactId: null,
    };
    const byPhone = matchOs(phoneOnly, catalog.osMasters);
    expect(byPhone.status).toBe("MATCHED");
    if (byPhone.status === "MATCHED") expect(byPhone.hits[0].matchedBy).toBe("phone");

    const byNameAddress = matchOs(crcById("CRC-SYN-1005"), catalog.osMasters);
    expect(byNameAddress.status).toBe("MATCHED");
    if (byNameAddress.status === "MATCHED") {
      expect(byNameAddress.hits[0].matchedBy).toBe("name_and_address");
    }

    const nameOnly = matchOs(crcById("CRC-SYN-1013"), catalog.osMasters);
    expect(nameOnly.status).toBe("MISSING");

    const bySmartCredit = matchOs(crcById("CRC-SYN-1011"), catalog.osMasters);
    expect(bySmartCredit.status).toBe("MATCHED");
    if (bySmartCredit.status === "MATCHED") expect(bySmartCredit.hits[0].matchedBy).toBe("provider_id");
  });

  it("does not decision a duplicate Grants master when a match exists", () => {
    const catalog = syntheticCatalog();
    const matched = decideCrcClient(crcById("CRC-SYN-1001"), catalog, NOW);
    expect(matched.resolution.os.status).toBe("MATCHED");
    expect(matched.futureCreate.createGrantsMaster).toBe(false);
    expect(wouldCreateDuplicateMaster(matched)).toBe(false);

    const missing = decideCrcClient(crcById("CRC-SYN-1004"), catalog, NOW);
    expect(missing.resolution.os.status).toBe("MISSING");
    expect(missing.resolution.ghl.status).toBe("MISSING");
    expect(missing.futureCreate).toMatchObject({
      createGrantsMaster: true,
      createGhlContact: true,
      createDisputeFox: false,
    });
  });

  it("does not auto-create DisputeFox for dormant or closed clients", () => {
    const catalog = syntheticCatalog();
    const dormant = decideCrcClient(crcById("CRC-SYN-1002"), catalog, NOW);
    expect(dormant.classification).toBe(CrcClientClassification.DORMANT_REACTIVATION_ELIGIBLE);
    expect(dormant.dfTransition.missingFromDf).toBe(true);
    expect(dormant.dfTransition.autoCreateDisputeFox).toBe(false);
    expect(dormant.dfTransition.flagForLaterDfCreateOrLink).toBe(false);
    expect(wouldAutoCreateDisputeFox(dormant)).toBe(false);

    const closed = decideCrcClient(crcById("CRC-SYN-1008"), catalog, NOW);
    expect(closed.classification).toBe(CrcClientClassification.CLOSED_DO_NOT_REACTIVATE);
    expect(closed.dfTransition.autoCreateDisputeFox).toBe(false);
    expect(closed.dfTransition.flagForLaterDfCreateOrLink).toBe(false);

    const recent = decideCrcClient(crcById("CRC-SYN-1003"), catalog, NOW);
    expect(recent.classification).toBe(CrcClientClassification.RECENTLY_WORKED_TRANSITION_RISK);
    expect(recent.dfTransition.flagForLaterDfCreateOrLink).toBe(true);
    expect(recent.dfTransition.autoCreateDisputeFox).toBe(false);
  });

  it("does not overwrite newer verified OS fields with older CRC", () => {
    const catalog = syntheticCatalog();
    const indigoOs = catalog.osMasters.find((m) => m.grantsClientId === "GC-SYN-000010");
    expect(indigoOs).toBeTruthy();
    const email = decideFieldBackfill("email", indigoOs!, crcById("CRC-SYN-1010"));
    expect(email.action).toBe("CONFLICT_REVIEW");

    const harperOs = catalog.osMasters.find((m) => m.grantsClientId === "GC-SYN-000009");
    const phone = decideFieldBackfill("phone", harperOs!, crcById("CRC-SYN-1009"));
    const address = decideFieldBackfill("address", harperOs!, crcById("CRC-SYN-1009"));
    expect(phone.action).toBe("FILL_BLANK");
    expect(address.action).toBe("FILL_BLANK");
  });

  it("searches OS + GHL + DF before a future create and links existing GHL without a second contact", () => {
    const catalog = syntheticCatalog();
    const nico = decideCrcClient(crcById("CRC-SYN-1015"), catalog, NOW);
    expect(nico.resolution.os.status).toBe("MISSING");
    expect(nico.resolution.ghl.status).toBe("MATCHED");
    expect(nico.futureCreate.createGrantsMaster).toBe(true);
    expect(nico.futureCreate.createGhlContact).toBe(false);
    expect(nico.futureCreate.createDisputeFox).toBe(false);
    expect(nico.enroll.welcome).toBe(false);
    expect(nico.enroll.fridayPulse).toBe(false);
    expect(nico.enroll.invoices).toBe(false);
    expect(nico.enroll.duplicateDfFiles).toBe(false);
  });

  it("builds every recovery report section and keeps GHL creates at 0 in dry-run", () => {
    const report = buildCrcRecoveryReport({
      crcClients: SYNTHETIC_CRC_EXPORT.clients,
      catalog: syntheticCatalog(),
      nowMs: NOW,
      generatedAt: SYNTHETIC_NOW_MS ? new Date(NOW).toISOString() : undefined,
    });

    expect(report.title).toBe(CRC_RECOVERY_REPORT_TITLE);
    expect(report.mode).toBe("dry-run");
    expect(report.liveSideEffects.ghlCreates).toBe(0);
    expect(report.liveSideEffects.dfCreates).toBe(0);
    expect(report.liveSideEffects.osCreates).toBe(0);
    expect(report.liveSideEffects.messagesSent).toBe(0);
    expect(reportSectionTitles(report)).toEqual([
      "CRC clients completely missing from Grants OS",
      "CRC clients completely missing from GHL",
      "CRC clients missing from DisputeFox",
      "Recovered contacts created in GHL",
      "Missing email/phone/address recovered",
      "Missing provider IDs recovered",
      "Documents/reports recovered",
      "Recently worked CRC clients not properly transitioned to DF",
      "Ambiguous identities requiring review",
    ]);

    expect(report.sections.recoveredContactsCreatedInGhl.count).toBe(0);
    expect(report.sections.crcMissingFromGrantsOs.rows.map((r) => r.crcClientId)).toEqual(
      expect.arrayContaining(["CRC-SYN-1004", "CRC-SYN-1013", "CRC-SYN-1015"]),
    );
    expect(report.sections.crcMissingFromGhl.rows.map((r) => r.crcClientId)).toEqual(
      expect.arrayContaining(["CRC-SYN-1002", "CRC-SYN-1004"]),
    );
    expect(report.sections.crcMissingFromDisputeFox.rows.map((r) => r.crcClientId)).toEqual(
      expect.arrayContaining(["CRC-SYN-1002", "CRC-SYN-1003", "CRC-SYN-1004"]),
    );
    expect(report.sections.missingContactFieldsRecovered.count).toBeGreaterThan(0);
    expect(
      report.sections.missingContactFieldsRecovered.rows.some((r) => r.crcClientId === "CRC-SYN-1009"),
    ).toBe(true);
    expect(report.sections.documentsReportsRecovered.count).toBe(2);
    expect(
      report.sections.recentlyWorkedNotTransitionedToDf.rows.map((r) => r.crcClientId),
    ).toContain("CRC-SYN-1003");
    expect(report.sections.ambiguousIdentitiesRequiringReview.rows.map((r) => r.crcClientId)).toContain(
      "CRC-SYN-1006",
    );
    expect(report.reviewQueue.some((r) => r.crcClientId === "CRC-SYN-1010")).toBe(true);

    const blob = JSON.stringify(report);
    expect(blob).not.toMatch(/@example\.test/);
    expect(blob).not.toMatch(/555010/);
    expect(blob).not.toMatch(/Rivera|Chen|Ortiz/);
  });

  it("refuses apply/create when the writes flag is off, and still refuses live GHL/DF if on", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const decisions = decideCrcExport(SYNTHETIC_CRC_EXPORT.clients, syntheticCatalog(), NOW);

    const off = applyCrcRecoveryDecisions(decisions);
    expect(off.applied).toBe(false);
    expect(off.refused).toBe(true);
    expect(off.writesEnabled).toBe(false);
    expect(off.ghlCreates).toBe(0);
    expect(off.dfCreates).toBe(0);
    expect(off.osCreates).toBe(0);
    expect(assertCrcRecoveryWriteAllowed("os_create").reason).toMatch(/CRC_RECOVERY_WRITES_ENABLED/);

    process.env[CRC_RECOVERY_WRITES_ENV] = "true";
    expect(assertCrcRecoveryWriteAllowed("ghl_create").ok).toBe(false);
    expect(assertCrcRecoveryWriteAllowed("df_create").ok).toBe(false);
    expect(assertCrcRecoveryWriteAllowed("message").ok).toBe(false);
    const on = applyCrcRecoveryDecisions(decisions);
    expect(on.applied).toBe(false);
    expect(on.ghlCreates).toBe(0);
    expect(on.dfCreates).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("projects the existing 26-master inbound GHL/DF shapes without inventing DF ids", () => {
    const os = projectConfirmedMastersToOsCatalog();
    const df = projectConfirmedDfRosterToDfCatalog();
    expect(os).toHaveLength(26);
    expect(df).toHaveLength(26);
    expect(CONFIRMED_MASTERS).toHaveLength(26);
    expect(CONFIRMED_DF_ROSTER).toHaveLength(26);
    expect(new Set(os.map((r) => normalizeEmail(r.email || ""))).size).toBe(26);
    expect(df.every((r) => !r.disputeFoxClientId)).toBe(true);

    const syntheticEmails = new Set(
      SYNTHETIC_CRC_EXPORT.clients.map((c) => (c.email ? normalizeEmail(c.email) : "")).filter(Boolean),
    );
    for (const master of CONFIRMED_MASTERS) {
      expect(syntheticEmails.has(normalizeEmail(master.email))).toBe(false);
      if (master.phone) {
        expect(SYNTHETIC_CRC_EXPORT.clients.some((c) => normalizePhone(c.phone) === normalizePhone(master.phone))).toBe(
          false,
        );
      }
    }
  });

  it("loads the checked-in synthetic CRC export fixture and rejects raw document bytes", () => {
    const paths = defaultFixturePaths();
    expect(fs.existsSync(paths.crcExport)).toBe(true);
    const loaded = loadCrcExport(paths.crcExport);
    expect(loaded.sourceSystem).toBe("CREDIT_REPAIR_CLOUD");
    expect(loaded.synthetic).toBe(true);
    expect(loaded.clients.length).toBe(SYNTHETIC_CRC_EXPORT.clients.length);

    expect(() =>
      parseCrcExport({
        sourceSystem: "CREDIT_REPAIR_CLOUD",
        clients: [
          {
            crcClientId: "CRC-SYN-BAD",
            firstName: "Bad",
            lastName: "Row",
            documents: [{ id: "x", crcClientId: "CRC-SYN-BAD", documentType: "CREDIT_REPORT", originalDate: "2020-01-01", rawIncluded: true }],
          },
        ],
      }),
    ).toThrow(/raw document/);
  });

  it("keeps identity resolution available for search-before-create", () => {
    const missing = resolveCrcIdentity(
      crcById("CRC-SYN-1004"),
      syntheticCatalog(),
      CrcClientClassification.DORMANT_REACTIVATION_ELIGIBLE,
    );
    expect(missing.unified).toBe("MISSING");
    expect(missing.os.status).toBe("MISSING");
    expect(missing.ghl.status).toBe("MISSING");
    expect(missing.df.status).toBe("MISSING");
  });
});
