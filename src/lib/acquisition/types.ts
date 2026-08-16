/**
 * Acquisition command-center enums (scaffolding).
 * Partner pipeline stages are not live GHL writes.
 */

export const PARTNER_PIPELINE_STAGES = [
  "NEW_PROSPECT",
  "QUALIFIED_PARTNER_PROSPECT",
  "OUTREACH_READY",
  "CONTACTED",
  "REPLIED",
  "INTRO_CALL",
  "PARTNER_INTERESTED",
  "ACTIVE_REFERRAL_PARTNER",
  "REFERRED_FIRST_CLIENT",
  "ACTIVE_PRODUCING_PARTNER",
  "NURTURE",
  "NOT_INTERESTED",
  "DND",
] as const;

export const CONSUMER_LEAD_STAGES = [
  "NEW_LEAD",
  "ATTEMPTING_CONTACT",
  "ENGAGED",
  "CONSULTATION_BOOKED",
  "CONSULTATION_COMPLETED",
  "QUALIFIED",
  "PAYMENT_PENDING",
  "PAID_ONBOARDING",
  "CONVERTED_CLIENT",
  "NURTURE",
  "LOST",
  "DND",
] as const;

export const ACQUISITION_SOURCES = [
  "GHL_PROSPECTING",
  "PROSPECT_AI",
  "REALTOR_PARTNER",
  "MORTGAGE_PARTNER",
  "BUILDER_PARTNER",
  "FORMER_CLIENT_REFERRAL",
  "FACEBOOK",
  "INSTAGRAM",
  "GOOGLE",
  "WEBSITE",
  "ORGANIC",
  "EMAIL_CAMPAIGN",
  "REACTIVATION_CAMPAIGN",
  "OTHER",
] as const;

export type PartnerPipelineStageValue = (typeof PARTNER_PIPELINE_STAGES)[number];
export type ConsumerLeadStageValue = (typeof CONSUMER_LEAD_STAGES)[number];
export type AcquisitionSourceValue = (typeof ACQUISITION_SOURCES)[number];

export const PARTNER_TYPES = ["REALTOR", "MORTGAGE", "BUILDER", "OTHER"] as const;
export type PartnerTypeValue = (typeof PARTNER_TYPES)[number];

export const CONVERTED_CONSUMER_STAGES = ["PAID_ONBOARDING", "CONVERTED_CLIENT"] as const;

export const OPEN_FOLLOW_UP_STAGES = [
  "NEW_LEAD",
  "ATTEMPTING_CONTACT",
  "ENGAGED",
  "CONSULTATION_BOOKED",
  "CONSULTATION_COMPLETED",
  "QUALIFIED",
  "PAYMENT_PENDING",
  "NURTURE",
] as const;

export const ACTIVE_PARTNER_STAGES = [
  "ACTIVE_REFERRAL_PARTNER",
  "REFERRED_FIRST_CLIENT",
  "ACTIVE_PRODUCING_PARTNER",
] as const;

export const PARTNER_PROSPECT_STAGES = [
  "NEW_PROSPECT",
  "QUALIFIED_PARTNER_PROSPECT",
  "OUTREACH_READY",
  "CONTACTED",
  "REPLIED",
  "INTRO_CALL",
  "PARTNER_INTERESTED",
  "NURTURE",
] as const;

export class AcquisitionError extends Error {
  constructor(
    public code:
      | "SOURCE_REQUIRED"
      | "INVALID_SOURCE"
      | "INVALID_STAGE"
      | "INVALID_PARTNER_TYPE"
      | "PARTNER_IS_NOT_A_CLIENT"
      | "CLIENT_REQUIRED"
      | "CLIENT_NOT_FOUND"
      | "REFUSE_SECOND_MASTER"
      | "REFUSE_CREATE_CLIENT"
      | "REFUSE_MIX_PARTNER_CLIENT"
      | "REFUSE_LIVE_SIDE_EFFECT"
      | "DND_LOCKED",
    message: string,
  ) {
    super(message);
    this.name = "AcquisitionError";
  }
}
