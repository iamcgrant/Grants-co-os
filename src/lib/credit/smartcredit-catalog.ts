import { buildSponsoredEnrollmentUrl } from "@/lib/credit/smartcredit-sponsor";

export const SMARTCREDIT_SESSION_KINDS = ["ENROLL", "LOGIN", "SCORE_REVIEW", "PACKET"] as const;
export type SmartCreditSessionKind = (typeof SMARTCREDIT_SESSION_KINDS)[number];

export function isSmartCreditSessionKind(value: string): value is SmartCreditSessionKind {
  return (SMARTCREDIT_SESSION_KINDS as readonly string[]).includes(value);
}

export function sessionKindLabel(kind: SmartCreditSessionKind): string {
  switch (kind) {
    case "ENROLL":
      return "Enrollment";
    case "LOGIN":
      return "Login session";
    case "SCORE_REVIEW":
      return "Score review";
    case "PACKET":
      return "Packet work";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Official last-step URL only. Never the workspace product UI. */
export function smartCreditLastStepUrl(kind: SmartCreditSessionKind, grantsClientId: string): string | null {
  switch (kind) {
    case "ENROLL":
      return buildSponsoredEnrollmentUrl({ grantsClientId }) ?? "https://www.smartcredit.com/join/";
    case "LOGIN":
      return "https://www.smartcredit.com/";
    case "SCORE_REVIEW":
    case "PACKET":
      return null;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
