/**
 * Deterministic mortgage READINESS scorer.
 * Not a credit score. Not an approval. Internal heuristic 0-100.
 */
export type EngineInput = {
  agreementRecorded: boolean;
  borrower: {
    firstName?: string | null;
    lastName?: string | null;
    dob?: string | null;
    ssnLast4?: string | null;
    phone?: string | null;
    email?: string | null;
    citizenship?: string | null;
  };
  employment: Array<{
    isCurrent: boolean;
    monthlyIncomeCents: number;
    yearsInLine?: number | null;
    monthsInLine?: number | null;
    selfEmployment?: boolean;
  }>;
  assets: Array<{ balanceCents: number }>;
  liabilities: Array<{ monthlyCents: number; unpaidCents: number }>;
  property?: {
    purchasePriceCents?: number | null;
    downPaymentCents?: number | null;
  } | null;
  documents: Array<{ category: string }>;
  creditRepairWithPackage?: boolean | null;
  declarations?: Record<string, boolean | null> | null;
};

export type EngineOutput = {
  score: number;
  strengths: string[];
  risks: string[];
  missingDocuments: string[];
  missingInformation: string[];
  recommendedAction: string;
  ruleHits: string[];
  clientStatus: "ON_TRACK" | "NEEDS_DOCUMENTS" | "IN_REVIEW" | "NOT_READY";
};

const DOC = {
  DL: "MORTGAGE_DRIVERS_LICENSE",
  SSN: "MORTGAGE_SSN_DOCUMENT",
  PAYSTUB: "MORTGAGE_PAYSTUB",
  W2: "MORTGAGE_W2",
  TAX: "MORTGAGE_TAX_RETURN",
  BANK: "MORTGAGE_BANK_STATEMENT",
  HERO: "MORTGAGE_CREDIT_HERO_PROOF",
  FICO: "MORTGAGE_MYFICO_SCORE",
};

export function scoreReadiness(input: EngineInput): EngineOutput {
  const hits: string[] = [];
  const strengths: string[] = [];
  const risks: string[] = [];
  const missingDocuments: string[] = [];
  const missingInformation: string[] = [];
  const cats = new Set(input.documents.map((d) => d.category));
  let score = 20;

  if (!input.agreementRecorded) {
    hits.push("NO_AGREEMENT");
    missingInformation.push("Signed Home Loan Readiness Service Agreement");
    return {
      score: 0,
      strengths,
      risks: ["Legal agreement not recorded"],
      missingDocuments,
      missingInformation,
      recommendedAction: "Complete the service agreement before file review.",
      ruleHits: hits,
      clientStatus: "NOT_READY",
    };
  }
  score += 10;
  hits.push("AGREEMENT_OK");

  const b = input.borrower;
  for (const [key, label] of [
    ["firstName", "Legal first name"],
    ["lastName", "Legal last name"],
    ["dob", "Date of birth"],
    ["ssnLast4", "SSN (vaulted)"],
    ["phone", "Mobile phone"],
    ["email", "Email"],
  ] as const) {
    if (!b[key]) missingInformation.push(label);
  }
  if (missingInformation.length === 0) {
    score += 10;
    strengths.push("Borrower identity complete");
  }

  const current = input.employment.find((e) => e.isCurrent);
  const monthly = input.employment.reduce((s, e) => s + (e.monthlyIncomeCents || 0), 0);
  if (!current) {
    missingInformation.push("Current employment");
    risks.push("Employment not stated");
  } else {
    score += 8;
    const months = (current.yearsInLine || 0) * 12 + (current.monthsInLine || 0);
    if (months >= 24) {
      score += 7;
      strengths.push("Stable employment");
    } else {
      risks.push("Employment tenure under 24 months");
      hits.push("SHORT_TENURE");
    }
    if (monthly >= 400000) {
      score += 5;
      strengths.push("Stated income present");
    }
    if (current.selfEmployment) {
      risks.push("Self-employment — tax returns and P&L required");
      hits.push("SELF_EMPLOYED");
      if (!cats.has("MORTGAGE_PROFIT_AND_LOSS")) missingDocuments.push("Profit and loss statement");
      if (!cats.has(DOC.TAX)) missingDocuments.push("Tax returns");
    }
  }

  const reserves = input.assets.reduce((s, a) => s + a.balanceCents, 0);
  const debts = input.liabilities.reduce((s, l) => s + l.monthlyCents, 0);
  if (reserves > 0) {
    score += 6;
    if (input.property?.purchasePriceCents && reserves >= (input.property.downPaymentCents || 0)) {
      score += 6;
      strengths.push("Adequate reserves vs stated down payment");
    }
  } else {
    missingInformation.push("Asset accounts");
    risks.push("No assets stated");
  }
  if (monthly > 0 && debts / monthly > 0.43) {
    score -= 8;
    risks.push("Stated monthly debts high vs stated income");
    hits.push("HIGH_DTI_HEURISTIC");
  }

  const requiredDocs = [DOC.DL, DOC.PAYSTUB, DOC.BANK];
  for (const d of requiredDocs) {
    if (!cats.has(d)) missingDocuments.push(d.replace("MORTGAGE_", "").replaceAll("_", " ").toLowerCase());
  }
  if (input.creditRepairWithPackage === true && !cats.has(DOC.HERO)) {
    missingDocuments.push("Credit Hero Score account confirmation");
  }
  if (input.creditRepairWithPackage === false && !cats.has(DOC.FICO)) {
    missingDocuments.push("MyFICO mortgage score screenshot");
  }
  if (missingDocuments.length === 0) {
    score += 10;
    strengths.push("Core documents present");
  } else {
    risks.push("Missing documents");
  }

  const dec = input.declarations || {};
  const riskFlags = [
    "bankruptcyLast7Years",
    "foreclosureLast7Years",
    "outstandingJudgments",
    "federalDebtDefault",
    "collections",
    "chargeOffs",
  ];
  for (const f of riskFlags) {
    if (dec[f] === true) {
      score -= 6;
      risks.push(f);
      hits.push("DECL_" + f);
    }
  }

  score = Math.max(0, Math.min(100, score));
  let clientStatus: EngineOutput["clientStatus"] = "IN_REVIEW";
  if (missingDocuments.length > 0 || missingInformation.length > 0) clientStatus = "NEEDS_DOCUMENTS";
  else if (score >= 80) clientStatus = "ON_TRACK";
  else if (score < 50) clientStatus = "NOT_READY";

  const recommendedAction = missingDocuments.length
    ? `Upload missing documents: ${missingDocuments.slice(0, 3).join(", ")}.`
    : missingInformation.length
      ? `Complete missing information: ${missingInformation.slice(0, 3).join(", ")}.`
      : "Human review — file is complete enough for underwriting-readiness QA.";

  return {
    score,
    strengths,
    risks,
    missingDocuments,
    missingInformation,
    recommendedAction,
    ruleHits: hits,
    clientStatus,
  };
}
