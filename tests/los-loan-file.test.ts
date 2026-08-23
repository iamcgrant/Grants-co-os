import { describe, expect, it } from "vitest";
import { createLoanFile } from "../src/lib/los/lifecycle";
import { formatLoanNumber, nextSequence, parseLoanNumber } from "../src/lib/los/loan-number";
import { createMortgageLosService } from "../src/lib/los/service";

describe("LoanFile create", () => {
  it("creates LoanFile at APP_STARTED with GC-LN-000001", () => {
    const file = createLoanFile({ seq: 1 });
    expect(file.originationStage).toBe("APP_STARTED");
    expect(file.loanNumber).toBe("GC-LN-000001");
  });

  it("formats, parses, and increments IdSequence", () => {
    expect(formatLoanNumber(42)).toBe("GC-LN-000042");
    expect(parseLoanNumber("GC-LN-000042")).toBe(42);
    expect(nextSequence(42)).toBe(43);
    expect(nextSequence("GC-LN-000001")).toBe(2);
  });

  it("service createApplication starts MORTGAGE_LOS file GC-LN-000001", () => {
    const los = createMortgageLosService();
    const created = los.createApplication({ clientId: "client_1" });
    expect(created.loanFile.originationStage).toBe("APP_STARTED");
    expect(created.loanFile.loanNumber).toBe("GC-LN-000001");
    expect(created.applicationId).toBeTruthy();
  });
});
