import { describe, it, expect, afterEach } from "vitest";
import {
  buildSponsoredEnrollmentUrl,
  getSmartCreditSponsorConfig,
} from "../src/lib/credit/smartcredit-sponsor";

describe("SmartCredit sponsor attribution", () => {
  afterEach(() => {
    delete process.env.SMARTCREDIT_SPONSOR_URL;
    delete process.env.SMARTCREDIT_SPONSOR_CODE;
  });

  it("returns null when sponsor is not configured", () => {
    expect(getSmartCreditSponsorConfig()).toEqual({
      sponsorUrl: null,
      sponsorCode: null,
    });
    expect(
      buildSponsoredEnrollmentUrl({ grantsClientId: "GC-000001" }),
    ).toBeNull();
  });

  it("preserves sponsor URL and appends Grants Client ID", () => {
    process.env.SMARTCREDIT_SPONSOR_URL =
      "https://www.smartcredit.com/enroll?aff=GRANTSCO";
    const url = buildSponsoredEnrollmentUrl({ grantsClientId: "GC-000184" });
    expect(url).toContain("aff=GRANTSCO");
    expect(url).toContain("gc_ref=GC-000184");
  });
});
