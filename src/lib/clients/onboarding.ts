/**
 * Canonical master-client onboarding checklist.
 * Acquisition, seed, and intake must reuse these keys — never a second path.
 */

export const MASTER_ONBOARDING_ITEMS = [
  { key: "intake", label: "Intake" },
  { key: "identification", label: "Identification" },
  { key: "proof_of_address", label: "Proof of address" },
  { key: "ssn_card", label: "Social Security card" },
  { key: "monitoring", label: "Monitoring setup" },
  { key: "smartcredit", label: "SmartCredit" },
  { key: "updated_report", label: "Updated report" },
  { key: "poa", label: "Power of attorney" },
  { key: "agreements", label: "Required agreements" },
  { key: "portal_access", label: "Portal access" },
] as const;

export type MasterOnboardingKey = (typeof MASTER_ONBOARDING_ITEMS)[number]["key"];
