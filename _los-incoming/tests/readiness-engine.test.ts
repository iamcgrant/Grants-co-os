import { describe, expect, it } from "vitest";
import { scoreReadiness } from "../src/readiness-engine";

describe("scoreReadiness", () => {
  it("returns 0 without agreement", () => {
    const out = scoreReadiness({
      agreementRecorded: false,
      borrower: {},
      employment: [],
      assets: [],
      liabilities: [],
      documents: [],
    });
    expect(out.score).toBe(0);
    expect(out.clientStatus).toBe("NOT_READY");
  });

  it("EXAMPLE 82-band: stable job, income, reserves, docs — labeled example only", () => {
    const out = scoreReadiness({
      agreementRecorded: true,
      borrower: {
        firstName: "Example",
        lastName: "Client",
        dob: "1990-01-01",
        ssnLast4: "0000",
        phone: "5550100",
        email: "example@example.com",
      },
      employment: [
        {
          isCurrent: true,
          monthlyIncomeCents: 1088000,
          yearsInLine: 4,
          monthsInLine: 11,
        },
      ],
      assets: [{ balanceCents: 1800000 }],
      liabilities: [{ monthlyCents: 40000, unpaidCents: 200000 }],
      property: { purchasePriceCents: 36700000, downPaymentCents: 1284500 },
      documents: [
        { category: "MORTGAGE_DRIVERS_LICENSE" },
        { category: "MORTGAGE_PAYSTUB" },
        { category: "MORTGAGE_BANK_STATEMENT" },
      ],
      creditRepairWithPackage: false,
    });
    expect(out.score).toBeGreaterThanOrEqual(70);
    expect(out.strengths.join(" ")).toMatch(/employment|income|reserves/i);
  });
});
