/**
 * Hard locks for the acquisition command center.
 * Scaffolding only — no live GHL, messages, Friday, or welcome.
 */

export const ACQUISITION_LOCKS = {
  oneHumanOneMaster: true,
  enginesSeparated: true,
  partnerIsClient: false,
  secondOnboardingPath: false,
  fridayEnabled: false,
  welcomeEnabled: false,
  coldSmsEnabled: false,
  outboundEmailEnabled: false,
  outboundIMessageEnabled: false,
  ghlContactWritesEnabled: false,
  ghlMessageWritesEnabled: false,
  ghlWorkflowPublishEnabled: false,
  prospectingUiEnabled: false,
  premiumProspectingPurchased: false,
  liveOutreachEnabled: false,
  clientContaminationAllowed: false,
} as const;

export const ACQUISITION_DO_NOT_ENROLL = {
  welcome: false,
  fridayPulse: false,
  onboardingWorkflow: false,
  poa: false,
  invoices: false,
  paymentRequests: false,
  coldSms: false,
} as const;

export type AcquisitionSideEffects = {
  friday: false;
  welcome: false;
  sms: false;
  ghlContactWrites: false;
  workflowPublish: false;
};

export function emptyAcquisitionSideEffects(): AcquisitionSideEffects {
  return {
    friday: false,
    welcome: false,
    sms: false,
    ghlContactWrites: false,
    workflowPublish: false,
  };
}
