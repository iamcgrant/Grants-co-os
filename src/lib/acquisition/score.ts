/**
 * GrantsLeadScore — behavioral / funnel signals only.
 * Protected characteristics and zip/census proxies are ignored.
 */

export const PROTECTED_SCORE_ATTRIBUTES = [
  "race",
  "color",
  "ethnicity",
  "nationalOrigin",
  "national_origin",
  "religion",
  "sex",
  "gender",
  "genderIdentity",
  "gender_identity",
  "sexualOrientation",
  "sexual_orientation",
  "age",
  "dateOfBirth",
  "dob",
  "disability",
  "familialStatus",
  "familial_status",
  "maritalStatus",
  "marital_status",
  "veteranStatus",
  "veteran_status",
  "geneticInformation",
  "genetic_information",
  "zipCode",
  "zip",
  "censusTract",
  "census_tract",
] as const;

export type ScoreReason = {
  code: string;
  points: number;
  detail: string;
};

export type GrantsLeadScoreInput = {
  acquisitionStage?: string | null;
  acquisitionSource?: string | null;
  doNotContact?: boolean;
  unsubscribed?: boolean;
  lastInteractionAt?: Date | null;
  now?: Date;
  intakeCompleteCount?: number;
  showedConsult?: boolean;
  /** Extra keys (including protected) may be passed; protected ones are dropped. */
  [key: string]: unknown;
};

const ALLOWED_SIGNAL_KEYS = new Set([
  "acquisitionStage",
  "acquisitionSource",
  "doNotContact",
  "unsubscribed",
  "lastInteractionAt",
  "now",
  "intakeCompleteCount",
  "showedConsult",
]);

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function ignoredProtectedAttributes(input: Record<string, unknown>): string[] {
  return PROTECTED_SCORE_ATTRIBUTES.filter((key) => input[key] !== undefined && input[key] !== null);
}

/**
 * Score a partner prospect or consumer lead.
 * Protected attributes never contribute points.
 */
export function scoreGrantsLead(input: GrantsLeadScoreInput): {
  score: number;
  reasons: ScoreReason[];
} {
  const reasons: ScoreReason[] = [];
  const ignored = ignoredProtectedAttributes(input);
  if (ignored.length > 0) {
    reasons.push({
      code: "PROTECTED_ATTRIBUTES_IGNORED",
      points: 0,
      detail: `Ignored protected / proxy attributes: ${ignored.join(", ")}`,
    });
  }

  for (const key of Object.keys(input)) {
    if (!ALLOWED_SIGNAL_KEYS.has(key) && !PROTECTED_SCORE_ATTRIBUTES.includes(key as (typeof PROTECTED_SCORE_ATTRIBUTES)[number])) {
      // Unknown extra keys are ignored (not scored).
      void key;
    }
  }

  if (input.doNotContact || input.unsubscribed) {
    reasons.push({
      code: "DND_OR_UNSUBSCRIBE",
      points: 0,
      detail: "DND / unsubscribe freezes score. Outreach stays off.",
    });
    return { score: 0, reasons };
  }

  let points = 0;
  const stage = input.acquisitionStage ?? "";

  const stagePoints: Record<string, { points: number; code: string; detail: string }> = {
    ENGAGED: { points: 15, code: "ENGAGED", detail: "Lead engaged or replied" },
    REPLIED: { points: 15, code: "REPLIED", detail: "Prospect replied" },
    CONSULTATION_BOOKED: { points: 20, code: "CONSULT_BOOKED", detail: "Consultation booked" },
    CONSULTATION_COMPLETED: { points: 25, code: "CONSULT_COMPLETED", detail: "Consultation completed" },
    QUALIFIED: { points: 20, code: "QUALIFIED", detail: "Qualified after consult" },
    PAYMENT_PENDING: { points: 20, code: "PAYMENT_PENDING", detail: "Payment pending" },
    PAID_ONBOARDING: { points: 25, code: "PAID", detail: "Paid — existing intake" },
    CONVERTED_CLIENT: { points: 30, code: "CONVERTED", detail: "Converted on existing master" },
    INTRO_CALL: { points: 15, code: "INTRO_CALL", detail: "Intro call completed" },
    PARTNER_INTERESTED: { points: 20, code: "PARTNER_INTERESTED", detail: "Partner interested" },
    ACTIVE_REFERRAL_PARTNER: { points: 25, code: "ACTIVE_PARTNER", detail: "Active referral partner" },
    REFERRED_FIRST_CLIENT: { points: 30, code: "REFERRED_FIRST", detail: "Referred first converted client" },
    ACTIVE_PRODUCING_PARTNER: { points: 35, code: "PRODUCING", detail: "Active producing partner" },
  };

  const stageHit = stagePoints[stage];
  if (stageHit) {
    points += stageHit.points;
    reasons.push(stageHit);
  }

  if (input.showedConsult) {
    points += 10;
    reasons.push({ code: "SHOWED", points: 10, detail: "Consult show stamped" });
  }

  const source = input.acquisitionSource ?? "";
  if (
    source === "REALTOR_PARTNER" ||
    source === "MORTGAGE_PARTNER" ||
    source === "BUILDER_PARTNER" ||
    source === "FORMER_CLIENT_REFERRAL"
  ) {
    points += 10;
    reasons.push({
      code: "REFERRAL_SOURCE",
      points: 10,
      detail: "Partner or former-client referral source",
    });
  }

  const complete = typeof input.intakeCompleteCount === "number" ? input.intakeCompleteCount : 0;
  if (complete > 0) {
    const intakePoints = Math.min(10, complete * 2);
    points += intakePoints;
    reasons.push({
      code: "INTAKE_PROGRESS",
      points: intakePoints,
      detail: `${complete} existing onboarding item(s) complete`,
    });
  }

  const now = input.now ?? new Date();
  if (input.lastInteractionAt instanceof Date) {
    const days = (now.getTime() - input.lastInteractionAt.getTime()) / 86_400_000;
    if (days <= 7) {
      points += 5;
      reasons.push({ code: "RECENT", points: 5, detail: "Interaction within 7 days" });
    }
  }

  return { score: clampScore(points), reasons };
}

export function serializeScoreReasons(reasons: ScoreReason[]): string {
  return JSON.stringify(reasons);
}
