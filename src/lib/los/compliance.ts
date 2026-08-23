/**
 * Compliance disclosure copy + gates.
 * Legal copy is DRAFT counsel (agreement version 2026-08-23-cognito-derived-draft-v1).
 * AGENT_ASSIGNMENT copy is generic — do not hardcode a person.
 */

import { LosHttpError } from "./errors";

export const DEFAULT_AGREEMENT_VERSION = "2026-08-23-cognito-derived-draft-v1";

export const COMPLIANCE_DISCLOSURE_TYPES = [
  "ACCOUNT_CREATION",
  "AGENT_ASSIGNMENT",
  "CREDIT_NO_NEW",
  "CREDIT_NO_LARGE_PURCHASES",
  "CREDIT_NO_ACCOUNT_CHANGES",
  "CREDIT_IMPACT",
  "PAYMENT_NONREFUNDABLE",
  "PAYMENT_CLEARED",
  "LOAN_AUDIT_LENDER_RIGHTS",
  "E_SIGN_CONSENT",
  "CREDIT_AUTHORIZATION",
  "INFORMATION_RELEASE",
  "CANCEL_FEE",
  "NO_CHANGE_MIND",
  "NO_GUARANTEES",
  "ALL_TERMS_PROCEED",
  "DPA_SELECTION",
] as const;

export type ComplianceDisclosureType = (typeof COMPLIANCE_DISCLOSURE_TYPES)[number];

export const DISCLOSURE_COPY: Record<ComplianceDisclosureType, string> = {
  ACCOUNT_CREATION:
    "I understand that a separate name, phone number, and email may be created on my behalf for lender and transaction purposes. Upon completion of the transaction, applicable login credentials and account access information will be provided.",
  AGENT_ASSIGNMENT:
    "I understand that an assigned real estate professional may assist with showings, negotiations, and transaction coordination throughout the home buying process.",
  CREDIT_NO_NEW: "I agree not to apply for new credit during this process.",
  CREDIT_NO_LARGE_PURCHASES: "I agree not to make large purchases.",
  CREDIT_NO_ACCOUNT_CHANGES: "I agree not to add or remove accounts without approval.",
  CREDIT_IMPACT:
    "I understand changes to credit, debts, or accounts may negatively impact loan approval.",
  PAYMENT_NONREFUNDABLE:
    "I understand this is a non-refundable service and payment must be made before services begin.",
  PAYMENT_CLEARED: "I understand services will not begin until payment has cleared.",
  LOAN_AUDIT_LENDER_RIGHTS:
    "Borrower acknowledges files may be reviewed, audited, and verified; lenders may request additional documentation; loan terms, approval decisions, conditions, or closing status may change based on lender review, underwriting, verification, appraisal, documentation, or other requirements; approval is not guaranteed until final lender approval; if a lender changes, modifies, delays, or cancels a transaction, lender requirements control the loan decision. If a transaction cannot proceed with the original lender due to lender requirements or loan eligibility changes, available options may include pursuing another lender or reviewing any eligible partial refund options according to the service agreement. Service fees remain subject to the signed agreement.",
  E_SIGN_CONSENT:
    "I consent to conduct this transaction electronically. Checking the box, typing my name, drawing my signature, and submitting records my agreement, the date, the time, and the IP address used.",
  CREDIT_AUTHORIZATION:
    "I authorize Grants & Co Consultants to obtain and review credit information for the purpose of home-loan readiness (not as a lender).",
  INFORMATION_RELEASE:
    "I authorize Grants & Co Consultants to share file information with assigned staff, the assigned real estate professional, and a referred lender as needed to perform this service.",
  CANCEL_FEE:
    "I understand that if I cancel after starting this process, I will incur an $1,800 cancellation fee payable to the realty company.",
  NO_CHANGE_MIND: "I understand this is not a process where I can start and change my mind.",
  NO_GUARANTEES:
    "I understand that no outcome, credit score increase, loan approval, interest rate, or property acquisition is guaranteed.",
  ALL_TERMS_PROCEED: "I agree to all terms and wish to proceed.",
  DPA_SELECTION:
    "I have indicated whether I want Down Payment Assistance added to my package for an additional $1,800. This selection is recorded and is not a submission blocker.",
};

/** Existing gate: e-sign packet must exist before 1003 PATCH. */
export const REQUIRED_FOR_SECTION_WRITE: readonly ComplianceDisclosureType[] = [
  "E_SIGN_CONSENT",
  "CREDIT_AUTHORIZATION",
  "INFORMATION_RELEASE",
  "ALL_TERMS_PROCEED",
];

/** Submit requires write-packet plus operational disclosures. DPA_SELECTION is not a blocker. */
export const REQUIRED_FOR_SUBMIT: readonly ComplianceDisclosureType[] = [
  "ACCOUNT_CREATION",
  "AGENT_ASSIGNMENT",
  "CREDIT_NO_NEW",
  "CREDIT_NO_LARGE_PURCHASES",
  "CREDIT_NO_ACCOUNT_CHANGES",
  "CREDIT_IMPACT",
  "PAYMENT_NONREFUNDABLE",
  "PAYMENT_CLEARED",
  "LOAN_AUDIT_LENDER_RIGHTS",
  "E_SIGN_CONSENT",
  "CREDIT_AUTHORIZATION",
  "INFORMATION_RELEASE",
  "ALL_TERMS_PROCEED",
];

export const PAYMENT_DISCLOSURE_TYPES: readonly ComplianceDisclosureType[] = [
  "PAYMENT_NONREFUNDABLE",
  "PAYMENT_CLEARED",
];

export type AcknowledgmentRow = {
  id: string;
  applicationId?: string;
  borrowerId: string;
  disclosureType: ComplianceDisclosureType;
  acknowledged: boolean;
  agreementVersion: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export type RecordAcknowledgmentInput = {
  existing: AcknowledgmentRow[];
  type: ComplianceDisclosureType;
  borrowerId: string;
  ip?: string | null;
  userAgent?: string | null;
  agreementVersion: string;
  now: Date;
  applicationId?: string;
  acknowledged?: boolean;
};

let ackSeq = 0;

export function recordAcknowledgment(input: RecordAcknowledgmentInput): AcknowledgmentRow[] {
  ackSeq += 1;
  const row: AcknowledgmentRow = {
    id: `ack_${ackSeq}`,
    applicationId: input.applicationId,
    borrowerId: input.borrowerId,
    disclosureType: input.type,
    acknowledged: input.acknowledged ?? true,
    agreementVersion: input.agreementVersion,
    ipAddress: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: input.now,
  };
  return [...input.existing.filter((e) => e.disclosureType !== input.type), row];
}

function acknowledgedTypes(acks: Iterable<{ disclosureType: string; acknowledged: boolean }>): Set<string> {
  const set = new Set<string>();
  for (const a of acks) {
    if (a.acknowledged) set.add(a.disclosureType);
  }
  return set;
}

export function missingFrom(
  acks: Iterable<{ disclosureType: string; acknowledged: boolean }>,
  required: readonly string[],
): string[] {
  const have = acknowledgedTypes(acks);
  return required.filter((t) => !have.has(t));
}

export function missingForWrite(
  acks: Iterable<{ disclosureType: string; acknowledged: boolean }>,
): string[] {
  return missingFrom(acks, REQUIRED_FOR_SECTION_WRITE);
}

export function missingForSubmit(
  acks: Iterable<{ disclosureType: string; acknowledged: boolean }>,
): string[] {
  return missingFrom(acks, REQUIRED_FOR_SUBMIT);
}

export function canPatchSections(
  acks: Iterable<{ disclosureType: string; acknowledged: boolean }>,
): boolean {
  return missingForWrite(acks).length === 0;
}

export function canSubmit(
  acks: Iterable<{ disclosureType: string; acknowledged: boolean }>,
): boolean {
  return missingForSubmit(acks).length === 0;
}

export function assertCanPatch(
  acks: Iterable<{ disclosureType: string; acknowledged: boolean }>,
): void {
  const missing = missingForWrite(acks);
  if (missing.length) {
    throw new LosHttpError(409, "COMPLIANCE_REQUIRED", missing, "Compliance packet required before section write");
  }
}

export function assertCanSubmit(
  acks: Iterable<{ disclosureType: string; acknowledged: boolean }>,
): void {
  const missing = missingForSubmit(acks);
  if (missing.length) {
    throw new LosHttpError(409, "COMPLIANCE_REQUIRED", missing, "Compliance acknowledgements required before submit");
  }
}

export function hasPaymentAcks(
  acks: Iterable<{ disclosureType: string; acknowledged: boolean }>,
): boolean {
  const have = acknowledgedTypes(acks);
  return PAYMENT_DISCLOSURE_TYPES.every((t) => have.has(t));
}

export function isComplianceDisclosureType(value: string): value is ComplianceDisclosureType {
  return (COMPLIANCE_DISCLOSURE_TYPES as readonly string[]).includes(value);
}
