/** Pure LOS qualification. Cents in. Bps out. Not an approval. */

export type QualInput = {
  purchasePriceCents: number | null;
  appraisedValueCents: number | null;
  downPaymentCents: number | null;
  loanAmountCents: number | null;
  noteRateBps: number | null;
  termMonths: number;
  monthlyPitiCents: number | null;
  subordinateCents: number;
  employments: Array<{
    isCurrent: boolean;
    monthlyIncomeCents: number;
    overtimeCents: number;
    bonusCents: number;
    commissionCents: number;
    businessIncomeCents: number;
    selfEmployment: boolean;
  }>;
  otherIncomeCents: number;
  liabilityMonthlyCents: number; // excludes to-be-paid-off
  assetBalanceCents: number;
  frontLimitBps: number;
  backLimitBps: number;
  ltvLimitBps: number;
};

export type QualOutput = {
  grossMonthlyIncomeCents: number;
  otherMonthlyIncomeCents: number;
  totalMonthlyIncomeCents: number;
  housingExpenseCents: number;
  otherDebtCents: number;
  totalDebtCents: number;
  frontDtiBps: number;
  backDtiBps: number;
  loanAmountCents: number;
  valueBasisCents: number;
  ltvBps: number;
  cltvBps: number;
  assetVerifiedCents: number;
  reservesMonthsBps: number;
  withinFront: boolean;
  withinBack: boolean;
  withinLtv: boolean;
  ruleHits: string[];
};

function monthlyPi(principal: number, rateBps: number, termMonths: number): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = rateBps / 10000 / 12;
  if (r === 0) return Math.round(principal / termMonths);
  const pow = Math.pow(1 + r, termMonths);
  return Math.round((principal * r * pow) / (pow - 1));
}

function ratioBps(num: number, den: number): number {
  if (den <= 0) return 99999;
  return Math.round((num * 10000) / den);
}

export function calculateQualification(input: QualInput): QualOutput {
  const hits: string[] = [];
  let gross = 0;
  for (const e of input.employments) {
    if (!e.isCurrent) continue;
    gross += e.monthlyIncomeCents + e.overtimeCents + e.bonusCents + e.commissionCents + e.businessIncomeCents;
    if (e.selfEmployment) hits.push("SELF_EMPLOYED_NEEDS_RETURNS");
  }
  hits.push("INCOME_STATED_NOT_AVERAGED");
  const other = input.otherIncomeCents;
  const totalIncome = gross + other;

  let loanAmount = input.loanAmountCents;
  if (
    loanAmount == null &&
    input.purchasePriceCents != null &&
    input.downPaymentCents != null
  ) {
    loanAmount = input.purchasePriceCents - input.downPaymentCents;
  }
  loanAmount = loanAmount ?? 0;

  let housing = input.monthlyPitiCents;
  if (housing == null) {
    const pi = monthlyPi(loanAmount, input.noteRateBps ?? 0, input.termMonths);
    housing = pi;
    hits.push("PITI_PI_ONLY");
  }

  const otherDebt = input.liabilityMonthlyCents;
  const totalDebt = housing + otherDebt;
  const front = ratioBps(housing, totalIncome);
  const back = ratioBps(totalDebt, totalIncome);
  if (totalIncome <= 0) hits.push("NO_INCOME");

  let value = 0;
  if (input.purchasePriceCents && input.appraisedValueCents) {
    value = Math.min(input.purchasePriceCents, input.appraisedValueCents);
  } else if (input.purchasePriceCents) {
    value = input.purchasePriceCents;
    hits.push("LTV_PURCHASE_ONLY");
  } else if (input.appraisedValueCents) {
    value = input.appraisedValueCents;
    hits.push("LTV_APPRAISAL_ONLY");
  } else {
    hits.push("NO_VALUE_BASIS");
  }

  const ltv = ratioBps(loanAmount, value);
  const cltv = ratioBps(loanAmount + input.subordinateCents, value);
  hits.push("ASSETS_STATED_NOT_VERIFIED");
  const assets = input.assetBalanceCents;
  const reserves = housing > 0 ? ratioBps(assets, housing) : 0;
  if (housing <= 0) hits.push("NO_HOUSING_EXPENSE");

  return {
    grossMonthlyIncomeCents: gross,
    otherMonthlyIncomeCents: other,
    totalMonthlyIncomeCents: totalIncome,
    housingExpenseCents: housing,
    otherDebtCents: otherDebt,
    totalDebtCents: totalDebt,
    frontDtiBps: front,
    backDtiBps: back,
    loanAmountCents: loanAmount,
    valueBasisCents: value,
    ltvBps: ltv,
    cltvBps: cltv,
    assetVerifiedCents: assets,
    reservesMonthsBps: reserves,
    withinFront: front <= input.frontLimitBps,
    withinBack: back <= input.backLimitBps,
    withinLtv: ltv <= input.ltvLimitBps,
    ruleHits: hits,
  };
}
