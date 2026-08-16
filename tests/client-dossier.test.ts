import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildClientDossierIntegrations, formatIntegrationField } from "../src/lib/clients/dossier";

describe("Client 360 dossier integrations", () => {
  const prev: Record<string, string | undefined> = {};
  const keys = ["GC_ENV", "GHL_API_KEY", "GHL_LOCATION_ID", "DISPUTEFOX_API_KEY", "SMARTCREDIT_SPONSOR_URL"] as const;

  beforeEach(() => {
    for (const k of keys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
    process.env.GC_ENV = "development";
  });

  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it("shows Awaiting Integration when GHL is not connected and no identifier", () => {
    const d = buildClientDossierIntegrations({
      grantsClientId: "GC-000001",
      identifiers: [],
      hasCreditScores: false,
      hasPaymentRecords: false,
      creditConnectionStatuses: [],
    });
    expect(d.ghlContactId.state).toBe("AWAITING_INTEGRATION");
    expect(formatIntegrationField(d.ghlContactId)).toBe("Awaiting Integration");
    expect(d.disputeFoxClientId.state).toBe("AWAITING_INTEGRATION");
    expect(d.ghlMessages.state).toBe("AWAITING_INTEGRATION");
  });

  it("labels seed identifiers as development sample", () => {
    const d = buildClientDossierIntegrations({
      grantsClientId: "GC-000001",
      identifiers: [
        {
          provider: "GHL",
          externalId: "ghl_contact_donna_001",
          metadataJson: JSON.stringify({ source: "seed", dataPlane: "development" }),
        },
      ],
      stage: "FILE_PREPARATION",
      hasCreditScores: true,
      hasPaymentRecords: true,
      creditConnectionStatuses: [{ provider: "SMARTCREDIT", status: "CONNECTED" }],
    });
    expect(d.ghlContactId.state).toBe("DEV_SAMPLE");
    expect(d.ghlContactId.value).toBe("ghl_contact_donna_001");
    expect(d.intakeStatus.value).toMatch(/FILE PREPARATION/i);
    expect(d.credit.state).toBe("DEV_SAMPLE");
    expect(d.payments.state).toBe("DEV_SAMPLE");
  });

  it("surfaces live GHL id when synced via API", () => {
    process.env.GHL_API_KEY = "test-key";
    process.env.GHL_LOCATION_ID = "loc_123";
    const d = buildClientDossierIntegrations({
      grantsClientId: "GC-000010",
      identifiers: [
        {
          provider: "GHL",
          externalId: "abc123live",
          metadataJson: JSON.stringify({
            source: "ghl_api",
            dataPlane: "development",
            syncedAt: "2026-08-16T12:00:00.000Z",
          }),
        },
      ],
      hasCreditScores: false,
      hasPaymentRecords: false,
      creditConnectionStatuses: [],
    });
    expect(d.ghlApiReady).toBe(true);
    expect(d.ghlContactId.state).toBe("LIVE");
    expect(d.ghlContactId.value).toBe("abc123live");
    expect(d.credit.state).toBe("AWAITING_INTEGRATION");
  });
});
