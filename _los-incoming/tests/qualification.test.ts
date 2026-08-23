import { describe, expect, it } from "vitest";
import { calculateQualification } from "../src/los/qualification";

describe("calculateQualification", () => {
  it("computes loan amount, front/back DTI, and LTV from cents", () => {
    const out = calculateQualification({
      purchasePriceCents: 36700000,
      appraisedValueCents: null,
      downPaymentCents: 1284500,
      loanAmountCents: null,
      noteRateBps: 650,
      termMonths: 360,
      monthlyPitiCents: 220000,
      subordinateCents: 0,
      employments: [
        {
          isCurrent: true,
          monthlyIncomeCents: 1088000,
          overtimeCents: 0,
          bonusCents: 0,
          commissionCents: 0,
          businessIncomeCents: 0,
          selfEmployment: false,
        },
      ],
      otherIncomeCents: 0,
      liabilityMonthlyCents: 40000,
      assetBalanceCents: 1800000,
      frontLimitBps: 2800,
      backLimitBps: 3600,
      ltvLimitBps: 9700,
    });
    expect(out.loanAmountCents).toBe(35415500);
    expect(out.totalMonthlyIncomeCents).toBe(1088000);
    expect(out.frontDtiBps).toBe(Math.round((220000 * 10000) / 1088000));
    expect(out.backDtiBps).toBe(Math.round((260000 * 10000) / 1088000));
    expect(out.ltvBps).toBe(Math.round((35415500 * 10000) / 36700000));
    expect(out.ruleHits).toContain("INCOME_STATED_NOT_AVERAGED");
    expect(out.ruleHits).toContain("ASSETS_STATED_NOT_VERIFIED");
    expect(out.ruleHits).toContain("LTV_PURCHASE_ONLY");
  });

  it("does not divide by zero income", () => {
    const out = calculateQualification({
      purchasePriceCents: 10000000,
      appraisedValueCents: 10000000,
      downPaymentCents: 0,
      loanAmountCents: 10000000,
      noteRateBps: 0,
      termMonths: 360,
      monthlyPitiCents: 100000,
      subordinateCents: 0,
      employments: [],
      otherIncomeCents: 0,
      liabilityMonthlyCents: 0,
      assetBalanceCents: 0,
      frontLimitBps: 2800,
      backLimitBps: 3600,
      ltvLimitBps: 9700,
    });
    expect(out.frontDtiBps).toBe(99999);
    expect(out.withinFront).toBe(false);
    expect(out.ruleHits).toContain("NO_INCOME");
  });
});
