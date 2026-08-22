export type StaffRole =
  | "OWNER"
  | "ADMIN"
  | "MANAGER"
  | "CUSTOMER_SERVICE"
  | "FILE_PREPARER"
  | "MARKETING"
  | "CLIENT";

export type NavGroup = "primary" | "ops" | "finance" | "system" | "credit" | "escalations" | "tax";

export type NavItem = {
  href: string;
  label: string;
  short?: string;
  group?: NavGroup;
};

/** Credit & Disputes destinations — native OS workspaces. */
export const CREDIT_DISPUTES_NAV = {
  hub: { href: "/credit", label: "Credit & Disputes", short: "Credit" },
  disputeFox: { href: "/credit/disputefox", label: "DisputeFox" },
  experian: { href: "/credit/experian", label: "Experian" },
  equifax: { href: "/credit/equifax", label: "Equifax" },
  transunion: { href: "/credit/transunion", label: "TransUnion" },
  innovis: { href: "/credit/innovis", label: "Innovis" },
  smartCredit: { href: "/credit/smartcredit", label: "SmartCredit" },
  creditKarma: { href: "/credit/credit-karma", label: "Credit Karma" },
} as const;

export const ESCALATIONS_NAV = {
  cfpb: { href: "/escalations/cfpb", label: "CFPB" },
} as const;

/** Tax desks — native OS workspaces, not portal bookmarks. */
export const TAX_NAV = {
  hub: { href: "/tax", label: "Tax", short: "Tax" },
  cloudTaxOffice: { href: "/tax/cloud-tax-office", label: "Cloud Tax Office" },
  cognito: { href: "/tax/cognito", label: "Cognito" },
  sbtpg: { href: "/tax/sbtpg", label: "SBTPG" },
} as const;

export function hasCreditDisputesNav(role: StaffRole): boolean {
  switch (role) {
    case "OWNER":
    case "ADMIN":
    case "CUSTOMER_SERVICE":
    case "FILE_PREPARER":
      return true;
    case "MANAGER":
    case "MARKETING":
    case "CLIENT":
      return false;
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

export function getCreditDisputesNav(): NavItem[] {
  return [
    { href: CREDIT_DISPUTES_NAV.disputeFox.href, label: CREDIT_DISPUTES_NAV.disputeFox.label, group: "credit" },
    { href: CREDIT_DISPUTES_NAV.experian.href, label: CREDIT_DISPUTES_NAV.experian.label, group: "credit" },
    { href: CREDIT_DISPUTES_NAV.equifax.href, label: CREDIT_DISPUTES_NAV.equifax.label, group: "credit" },
    { href: CREDIT_DISPUTES_NAV.transunion.href, label: CREDIT_DISPUTES_NAV.transunion.label, group: "credit" },
    { href: CREDIT_DISPUTES_NAV.innovis.href, label: CREDIT_DISPUTES_NAV.innovis.label, group: "credit" },
    { href: CREDIT_DISPUTES_NAV.smartCredit.href, label: CREDIT_DISPUTES_NAV.smartCredit.label, group: "credit" },
    { href: CREDIT_DISPUTES_NAV.creditKarma.href, label: CREDIT_DISPUTES_NAV.creditKarma.label, group: "credit" },
  ];
}

export function getEscalationsNav(): NavItem[] {
  return [{ href: ESCALATIONS_NAV.cfpb.href, label: ESCALATIONS_NAV.cfpb.label, group: "escalations" }];
}

export function hasTaxNav(role: StaffRole): boolean {
  return hasCreditDisputesNav(role);
}

export function getTaxNav(): NavItem[] {
  return [
    { href: TAX_NAV.cloudTaxOffice.href, label: TAX_NAV.cloudTaxOffice.label, group: "tax" },
    { href: TAX_NAV.cognito.href, label: TAX_NAV.cognito.label, group: "tax" },
    { href: TAX_NAV.sbtpg.href, label: TAX_NAV.sbtpg.label, group: "tax" },
  ];
}

export function navSectionLabel(group: NavGroup | undefined): string | null {
  switch (group) {
    case undefined:
    case "primary":
      return null;
    case "ops":
      return "Operations";
    case "finance":
      return "Finance";
    case "system":
      return "System";
    case "credit":
      return "Credit & Disputes";
    case "escalations":
      return "Escalations";
    case "tax":
      return "Tax";
    default: {
      const _exhaustive: never = group;
      return _exhaustive;
    }
  }
}

/** Mobile bottom nav — keep lean; Credit opens the Credit & Disputes hub. */
export function getStaffNav(role: StaffRole): NavItem[] {
  switch (role) {
    case "OWNER":
    case "ADMIN":
      return [
        { href: "/home", label: "Home", short: "Home" },
        { href: "/clients", label: "Clients", short: "Clients" },
        { href: "/inbox", label: "Inbox", short: "Inbox" },
        { href: "/dialer", label: "Dialer", short: "Call" },
        { href: "/work", label: "Work", short: "Work" },
        { href: CREDIT_DISPUTES_NAV.hub.href, label: CREDIT_DISPUTES_NAV.hub.label, short: CREDIT_DISPUTES_NAV.hub.short },
        { href: "/pay", label: "Pay", short: "Pay" },
        { href: "/agents", label: "Agents", short: "Agents" },
        { href: "/more", label: "More", short: "More" },
      ];
    case "CUSTOMER_SERVICE":
      return [
        { href: "/home", label: "Home", short: "Home" },
        { href: "/clients", label: "Clients", short: "Clients" },
        { href: "/inbox", label: "Inbox", short: "Inbox" },
        { href: "/dialer", label: "Dialer", short: "Call" },
        { href: "/work", label: "Care", short: "Care" },
        { href: CREDIT_DISPUTES_NAV.hub.href, label: CREDIT_DISPUTES_NAV.hub.label, short: CREDIT_DISPUTES_NAV.hub.short },
        { href: "/more", label: "More", short: "More" },
      ];
    case "FILE_PREPARER":
      return [
        { href: "/home", label: "Home", short: "Home" },
        { href: "/clients", label: "Clients", short: "Clients" },
        { href: "/inbox", label: "Inbox", short: "Inbox" },
        { href: "/work", label: "Files", short: "Files" },
        { href: CREDIT_DISPUTES_NAV.hub.href, label: CREDIT_DISPUTES_NAV.hub.label, short: CREDIT_DISPUTES_NAV.hub.short },
        { href: "/more", label: "More", short: "More" },
      ];
    case "MANAGER":
    case "MARKETING":
    case "CLIENT":
      return [
        { href: "/home", label: "Home", short: "Home" },
        { href: "/clients", label: "Clients", short: "Clients" },
        { href: "/inbox", label: "Inbox", short: "Inbox" },
        { href: "/work", label: "Work", short: "Work" },
      ];
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

/** Desktop sidebar — denser enterprise module map */
export function getDesktopNav(role: StaffRole): NavItem[] {
  if (role === "OWNER" || role === "ADMIN") {
    return [
      { href: "/home", label: "Dashboard", group: "primary" },
      { href: "/clients", label: "Clients", group: "primary" },
      { href: "/inbox", label: "Inbox", group: "primary" },
      { href: "/dialer", label: "Dialer", group: "primary" },
      { href: "/team-chat", label: "Team", group: "primary" },
      { href: "/work", label: "Tasks", group: "ops" },
      ...getCreditDisputesNav(),
      ...getEscalationsNav(),
      ...getTaxNav(),
      { href: "/pay", label: "Grants Pay", group: "finance" },
      { href: "/intelligence", label: "Reports", group: "finance" },
      { href: "/acquisition", label: "Acquisition", group: "finance" },
      { href: "/automations", label: "Automations", group: "system" },
      { href: "/system-health", label: "System Health", group: "system" },
      { href: "/agents", label: "Agent Hub", group: "system" },
      { href: "/more", label: "Settings", group: "system" },
    ];
  }

  if (role === "CUSTOMER_SERVICE") {
    return [
      { href: "/home", label: "Client Care", group: "primary" },
      { href: "/clients", label: "Clients", group: "primary" },
      { href: "/inbox", label: "Inbox", group: "primary" },
      { href: "/dialer", label: "Dialer", group: "primary" },
      { href: "/team-chat", label: "Team", group: "primary" },
      { href: "/work", label: "Tasks", group: "ops" },
      ...getCreditDisputesNav(),
      ...getEscalationsNav(),
      ...getTaxNav(),
      { href: "/search", label: "Search", group: "system" },
      { href: "/more", label: "Settings", group: "system" },
    ];
  }

  if (role === "FILE_PREPARER") {
    return [
      { href: "/home", label: "Processing", group: "primary" },
      { href: "/clients", label: "Clients", group: "primary" },
      { href: "/inbox", label: "Inbox", group: "primary" },
      { href: "/dialer", label: "Dialer", group: "primary" },
      { href: "/team-chat", label: "Team", group: "primary" },
      { href: "/work", label: "File Queues", group: "ops" },
      ...getCreditDisputesNav(),
      ...getEscalationsNav(),
      ...getTaxNav(),
      { href: "/search", label: "Search", group: "system" },
      { href: "/more", label: "Settings", group: "system" },
    ];
  }

  return getStaffNav(role).map((n) => ({ ...n, group: "primary" as const }));
}

export function roleHomeLabel(role: StaffRole): string {
  switch (role) {
    case "OWNER":
    case "ADMIN":
      return "Command Center";
    case "CUSTOMER_SERVICE":
      return "Client Care";
    case "FILE_PREPARER":
      return "File Processing";
    case "MANAGER":
    case "MARKETING":
    case "CLIENT":
      return "Workspace";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

export function roleDisplayName(role: StaffRole): string {
  switch (role) {
    case "OWNER":
      return "Owner";
    case "CUSTOMER_SERVICE":
      return "Client Care";
    case "FILE_PREPARER":
      return "File Preparation";
    case "ADMIN":
      return "Administrator";
    case "MANAGER":
      return "Manager";
    case "MARKETING":
      return "Marketing";
    case "CLIENT":
      return "Client";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}
