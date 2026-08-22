import { describe, expect, it } from "vitest";
import { caseDetailHref, DISPUTE_CHANNELS, nextDisputeStatus, type DisputeChannel } from "@/lib/disputes/channels";

describe("official bureau / CFPB / DisputeFox catalog", () => {
  const channels = Object.keys(DISPUTE_CHANNELS) as DisputeChannel[];

  it("never claims in-app submit, scrape, or e-OSCAR", () => {
    for (const channel of channels) {
      const row = DISPUTE_CHANNELS[channel];
      expect(row.scrape).toBe(false);
      expect(row.eOscarAvailable).toBe(false);
      expect(row.hasOfficialSubmitApi).toBe(false);
      expect(row.canSubmitInApp).toBe(false);
      expect(row.honesty).not.toMatch(/scrape|unofficial api/i);
    }
  });

  it("keeps Credit Karma out of dispute-submit channels", () => {
    expect(channels).not.toContain("CREDIT_KARMA" as DisputeChannel);
  });

  it("documents official last-step portals without making them the product", () => {
    expect(DISPUTE_CHANNELS.EXPERIAN.officialSubmitUrl).toMatch(/experian\.com/);
    expect(DISPUTE_CHANNELS.CFPB.officialSubmitUrl).toMatch(/consumerfinance\.gov\/complaint/);
    expect(DISPUTE_CHANNELS.EQUIFAX.officialSubmitUrl).toMatch(/equifax\.com/);
    expect(DISPUTE_CHANNELS.TRANSUNION.officialSubmitUrl).toMatch(/transunion\.com/);
    expect(DISPUTE_CHANNELS.INNOVIS.officialSubmitUrl).toMatch(/innovis\.com/);
    expect(DISPUTE_CHANNELS.DISPUTEFOX.hasOfficialSubmitApi).toBe(false);
    expect(DISPUTE_CHANNELS.DISPUTEFOX.officialSubmitUrl).toBe("https://pulse.disputeprocess.com");
    expect(DISPUTE_CHANNELS.SMARTCREDIT.hasOfficialSubmitApi).toBe(false);
    expect(DISPUTE_CHANNELS.SMARTCREDIT.officialSubmitUrl).toMatch(/smartcredit\.com/);
    expect(DISPUTE_CHANNELS.SMARTCREDIT.href).toBe("/credit/smartcredit");
  });

  it("keeps case detail hrefs serializable and channel-specific", () => {
    expect(caseDetailHref("EXPERIAN", "case_1")).toBe("/credit/experian/case_1");
    expect(caseDetailHref("EQUIFAX", "case_1")).toBe("/credit/equifax/case_1");
    expect(caseDetailHref("TRANSUNION", "case_1")).toBe("/credit/transunion/case_1");
    expect(caseDetailHref("INNOVIS", "case_1")).toBe("/credit/innovis/case_1");
    expect(caseDetailHref("CFPB", "case_1")).toBe("/escalations/cfpb/case_1");
    expect(caseDetailHref("DISPUTEFOX", "case_1")).toBe("/credit/disputefox/case/case_1");
    expect(caseDetailHref("SMARTCREDIT", "case_1")).toBe("/credit/smartcredit/case/case_1");
  });

  it("advances intake through closed", () => {
    expect(nextDisputeStatus("INTAKE")).toBe("PACKET");
    expect(nextDisputeStatus("PACKET")).toBe("READY");
    expect(nextDisputeStatus("READY")).toBe("SUBMITTED");
    expect(nextDisputeStatus("SUBMITTED")).toBe("RESULTS");
    expect(nextDisputeStatus("RESULTS")).toBe("CLOSED");
    expect(nextDisputeStatus("CLOSED")).toBeNull();
  });
});
