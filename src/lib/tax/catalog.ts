/**
 * Tax staff desks — native OS workspaces.
 * Official portals are last-step only. No scrape.
 */

export const TAX_DESKS = ["CLOUD_TAX_OFFICE", "SBTPG"] as const;
export type TaxDesk = (typeof TAX_DESKS)[number];

export const CLOUD_TAX_STATUSES = [
  "INTAKE",
  "IN_PREP",
  "REVIEW",
  "FILED",
  "ACCEPTED",
  "REJECTED",
  "CLOSED",
] as const;
export type CloudTaxStatus = (typeof CLOUD_TAX_STATUSES)[number];

export const SBTPG_STATUSES = [
  "PENDING",
  "APPROVED",
  "FUNDED",
  "PAID",
  "UNFUNDED",
  "HOLD",
  "REJECTED",
  "CLOSED",
] as const;
export type SbtpgStatus = (typeof SBTPG_STATUSES)[number];

export const CLOUD_TAX_SESSION_KINDS = ["LOGIN", "RETURN_STATUS", "FILE", "RESULT"] as const;
export type CloudTaxSessionKind = (typeof CLOUD_TAX_SESSION_KINDS)[number];

export const SBTPG_SESSION_KINDS = ["LOGIN", "PAYOUT_CHECK", "RESULT"] as const;
export type SbtpgSessionKind = (typeof SBTPG_SESSION_KINDS)[number];

export type TaxSessionKind = CloudTaxSessionKind | SbtpgSessionKind;
export type TaxDeskStatus = CloudTaxStatus | SbtpgStatus;

export type TaxDeskCatalog = {
  desk: TaxDesk;
  label: string;
  href: string;
  eyebrow: string;
  provider: TaxDesk;
  integration: "cloud_tax_office" | "sbtpg";
  hasOfficialSubmitApi: false;
  hasOfficialPortal: true;
  officialLastStepUrl: string;
  scrape: false;
  honesty: string;
  statuses: readonly TaxDeskStatus[];
  sessionKinds: readonly TaxSessionKind[];
};

export const TAX_DESK_CATALOG: Record<TaxDesk, TaxDeskCatalog> = {
  CLOUD_TAX_OFFICE: {
    desk: "CLOUD_TAX_OFFICE",
    label: "Cloud Tax Office",
    href: "/tax/cloud-tax-office",
    eyebrow: "Tax",
    provider: "CLOUD_TAX_OFFICE",
    integration: "cloud_tax_office",
    hasOfficialSubmitApi: false,
    hasOfficialPortal: true,
    officialLastStepUrl: "https://grantandco.cloudtaxoffice.com/proavalon/",
    scrape: false,
    honesty:
      "No supported Cloud Tax Office (ProAvalon) list/read API. This workspace is the OS staff desk: client/return list, status, and next actions. Official Cloud Tax Office is a last login/file step only. No scrape.",
    statuses: CLOUD_TAX_STATUSES,
    sessionKinds: CLOUD_TAX_SESSION_KINDS,
  },
  SBTPG: {
    desk: "SBTPG",
    label: "SBTPG payouts",
    href: "/tax/sbtpg",
    eyebrow: "Tax",
    provider: "SBTPG",
    integration: "sbtpg",
    hasOfficialSubmitApi: false,
    hasOfficialPortal: true,
    officialLastStepUrl: "https://pro.sbtpg.com/login",
    scrape: false,
    honesty:
      "No supported SBTPG refund/payout list API. This workspace is the OS tracker for tax-client refunds and payouts. Official SBTPG portal is a last login step only. No scrape.",
    statuses: SBTPG_STATUSES,
    sessionKinds: SBTPG_SESSION_KINDS,
  },
};

export function isTaxDesk(value: string): value is TaxDesk {
  return (TAX_DESKS as readonly string[]).includes(value);
}

export function taxDeskCatalog(desk: TaxDesk): TaxDeskCatalog {
  return TAX_DESK_CATALOG[desk];
}

export function isCloudTaxStatus(value: string): value is CloudTaxStatus {
  return (CLOUD_TAX_STATUSES as readonly string[]).includes(value);
}

export function isSbtpgStatus(value: string): value is SbtpgStatus {
  return (SBTPG_STATUSES as readonly string[]).includes(value);
}

export function isCloudTaxSessionKind(value: string): value is CloudTaxSessionKind {
  return (CLOUD_TAX_SESSION_KINDS as readonly string[]).includes(value);
}

export function isSbtpgSessionKind(value: string): value is SbtpgSessionKind {
  return (SBTPG_SESSION_KINDS as readonly string[]).includes(value);
}

export function isDeskStatus(desk: TaxDesk, value: string): value is TaxDeskStatus {
  switch (desk) {
    case "CLOUD_TAX_OFFICE":
      return isCloudTaxStatus(value);
    case "SBTPG":
      return isSbtpgStatus(value);
    default: {
      const _exhaustive: never = desk;
      return _exhaustive;
    }
  }
}

export function isDeskSessionKind(desk: TaxDesk, value: string): value is TaxSessionKind {
  switch (desk) {
    case "CLOUD_TAX_OFFICE":
      return isCloudTaxSessionKind(value);
    case "SBTPG":
      return isSbtpgSessionKind(value);
    default: {
      const _exhaustive: never = desk;
      return _exhaustive;
    }
  }
}

export function taxStatusLabel(status: TaxDeskStatus): string {
  switch (status) {
    case "INTAKE":
      return "Intake";
    case "IN_PREP":
      return "In prep";
    case "REVIEW":
      return "Review";
    case "FILED":
      return "Filed";
    case "ACCEPTED":
      return "Accepted";
    case "REJECTED":
      return "Rejected";
    case "CLOSED":
      return "Closed";
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "FUNDED":
      return "Funded";
    case "PAID":
      return "Paid";
    case "UNFUNDED":
      return "Unfunded";
    case "HOLD":
      return "Hold";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function taxSessionKindLabel(kind: TaxSessionKind): string {
  switch (kind) {
    case "LOGIN":
      return "Login / launch";
    case "RETURN_STATUS":
      return "Return status";
    case "FILE":
      return "File return";
    case "RESULT":
      return "Result";
    case "PAYOUT_CHECK":
      return "Payout check";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Official last-step URL only. Never the workspace product UI. */
export function taxLastStepUrl(desk: TaxDesk, kind: TaxSessionKind): string | null {
  const catalog = taxDeskCatalog(desk);
  switch (desk) {
    case "CLOUD_TAX_OFFICE":
      return kind === "LOGIN" || kind === "FILE" ? catalog.officialLastStepUrl : null;
    case "SBTPG":
      return kind === "LOGIN" ? catalog.officialLastStepUrl : null;
    default: {
      const _exhaustive: never = desk;
      return _exhaustive;
    }
  }
}
