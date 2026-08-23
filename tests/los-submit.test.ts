import { describe, expect, it } from "vitest";
import { REQUIRED_FOR_SUBMIT } from "../src/lib/los/compliance";
import { LosHttpError } from "../src/lib/los/errors";
import { createMortgageLosService } from "../src/lib/los/service";

describe("application submit", () => {
  it("APP_STARTED → APP_SUBMITTED when all required acks exist; payment fields set", () => {
    const los = createMortgageLosService();
    const { applicationId, loanFile } = los.createApplication({ clientId: "client_1" });
    expect(loanFile.originationStage).toBe("APP_STARTED");
    los.acknowledgeCompliance({
      applicationId,
      disclosures: [...REQUIRED_FOR_SUBMIT],
      signature: { typedFirst: "Example", typedLast: "Borrower", drawnSignatureKey: "sig-1" },
    });
    const submitted = los.submitApplication({ applicationId });
    expect(submitted.originationStage).toBe("APP_SUBMITTED");
    expect(submitted.loanFile.originationStage).toBe("APP_SUBMITTED");
    expect(submitted.loanFile.paymentAcknowledged).toBe(true);
    expect(submitted.loanFile.paymentAcknowledgedAt).toBeInstanceOf(Date);
  });

  it("409 without LOAN_AUDIT_LENDER_RIGHTS and other required acks", () => {
    const los = createMortgageLosService();
    const { applicationId } = los.createApplication({ clientId: "client_1" });
    const withoutAudit = REQUIRED_FOR_SUBMIT.filter((t) => t !== "LOAN_AUDIT_LENDER_RIGHTS");
    los.acknowledgeCompliance({ applicationId, disclosures: withoutAudit });
    try {
      los.submitApplication({ applicationId });
      throw new Error("expected 409");
    } catch (err) {
      const e = err as LosHttpError;
      expect(e.status).toBe(409);
      expect(e.code).toBe("COMPLIANCE_REQUIRED");
      expect(e.missing).toContain("LOAN_AUDIT_LENDER_RIGHTS");
    }

    const empty = createMortgageLosService();
    const created = empty.createApplication({ clientId: "client_2" });
    try {
      empty.submitApplication({ applicationId: created.applicationId });
      throw new Error("expected 409");
    } catch (err) {
      const e = err as LosHttpError;
      expect(e.status).toBe(409);
      expect(e.code).toBe("COMPLIANCE_REQUIRED");
      for (const t of REQUIRED_FOR_SUBMIT) {
        expect(e.missing).toContain(t);
      }
    }
  });

  it("rejects submit when stage is not APP_STARTED", () => {
    const los = createMortgageLosService();
    const { applicationId } = los.createApplication({ clientId: "client_1" });
    los.acknowledgeCompliance({ applicationId, disclosures: [...REQUIRED_FOR_SUBMIT] });
    los.submitApplication({ applicationId });
    try {
      los.submitApplication({ applicationId });
      throw new Error("expected 422");
    } catch (err) {
      const e = err as LosHttpError;
      expect(e.status).toBe(422);
      expect(e.code).toBe("INVALID_STAGE");
    }
  });
});
