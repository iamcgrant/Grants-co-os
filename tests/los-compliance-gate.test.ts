import { describe, expect, it } from "vitest";
import {
  REQUIRED_FOR_SECTION_WRITE,
  missingForWrite,
} from "../src/lib/los/compliance";
import { LosHttpError } from "../src/lib/los/errors";
import { createMortgageLosService } from "../src/lib/los/service";

describe("compliance gate for section PATCH", () => {
  it("PATCH before acknowledgement is 409 and lists missing required types", () => {
    const los = createMortgageLosService();
    const { applicationId } = los.createApplication({ clientId: "client_1" });
    try {
      los.patchSection({
        applicationId,
        section: "BORROWER",
        body: { firstNameOnDl: "Example" },
      });
      throw new Error("expected 409");
    } catch (err) {
      expect(err).toBeInstanceOf(LosHttpError);
      const e = err as LosHttpError;
      expect(e.status).toBe(409);
      expect(e.code).toBe("COMPLIANCE_REQUIRED");
      expect(e.missing).toEqual([...REQUIRED_FOR_SECTION_WRITE]);
      for (const t of REQUIRED_FOR_SECTION_WRITE) {
        expect(e.missing).toContain(t);
      }
    }
  });

  it("lists only the remaining missing write types after a partial packet", () => {
    const los = createMortgageLosService();
    const { applicationId } = los.createApplication({ clientId: "client_1" });
    los.acknowledgeCompliance({
      applicationId,
      disclosures: ["E_SIGN_CONSENT", "CREDIT_AUTHORIZATION", "INFORMATION_RELEASE"],
    });
    try {
      los.patchSection({
        applicationId,
        section: "LOAN",
        body: { loanPurpose: "PURCHASE" },
      });
      throw new Error("expected 409");
    } catch (err) {
      const e = err as LosHttpError;
      expect(e.status).toBe(409);
      expect(e.code).toBe("COMPLIANCE_REQUIRED");
      expect(e.missing).toEqual(["ALL_TERMS_PROCEED"]);
      expect(missingForWrite([{ disclosureType: "E_SIGN_CONSENT", acknowledged: true }])).toContain(
        "CREDIT_AUTHORIZATION",
      );
    }
  });
});
