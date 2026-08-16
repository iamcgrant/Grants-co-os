export type StaffRole =
  | "OWNER"
  | "ADMIN"
  | "MANAGER"
  | "CUSTOMER_SERVICE"
  | "FILE_PREPARER"
  | "MARKETING"
  | "CLIENT";

export type NavItem = {
  href: string;
  label: string;
  short?: string;
  group?: "primary" | "ops" | "finance" | "system";
};

/** Mobile bottom nav — keep lean */
export function getStaffNav(role: StaffRole): NavItem[] {
  switch (role) {
    case "OWNER":
    case "ADMIN":
      return [
        { href: "/home", label: "Home", short: "Home" },
        { href: "/clients", label: "Clients", short: "Clients" },
        { href: "/inbox", label: "Inbox", short: "Inbox" },
        { href: "/work", label: "Work", short: "Work" },
        { href: "/credit-pulse", label: "Credit", short: "Credit" },
        { href: "/pay", label: "Pay", short: "Pay" },
        { href: "/more", label: "More", short: "More" },
      ];
    case "CUSTOMER_SERVICE":
      return [
        { href: "/home", label: "Home", short: "Home" },
        { href: "/clients", label: "Clients", short: "Clients" },
        { href: "/inbox", label: "Inbox", short: "Inbox" },
        { href: "/work", label: "Care", short: "Care" },
        { href: "/credit-pulse", label: "Credit", short: "Credit" },
        { href: "/more", label: "More", short: "More" },
      ];
    case "FILE_PREPARER":
      return [
        { href: "/home", label: "Home", short: "Home" },
        { href: "/clients", label: "Clients", short: "Clients" },
        { href: "/inbox", label: "Inbox", short: "Inbox" },
        { href: "/work", label: "Files", short: "Files" },
        { href: "/credit-pulse", label: "Credit", short: "Credit" },
        { href: "/more", label: "More", short: "More" },
      ];
    default:
      return [
        { href: "/home", label: "Home", short: "Home" },
        { href: "/clients", label: "Clients", short: "Clients" },
        { href: "/inbox", label: "Inbox", short: "Inbox" },
        { href: "/work", label: "Work", short: "Work" },
      ];
  }
}

/** Desktop sidebar — denser enterprise module map */
export function getDesktopNav(role: StaffRole): NavItem[] {
  const commonPrimary: NavItem[] = [
    { href: "/home", label: "Command", group: "primary" },
    { href: "/clients", label: "Clients", group: "primary" },
    { href: "/inbox", label: "Inbox", group: "primary" },
    { href: "/work", label: "Work", group: "ops" },
    { href: "/credit-pulse", label: "Credit Intel", group: "ops" },
  ];

  if (role === "OWNER" || role === "ADMIN") {
    return [
      ...commonPrimary,
      { href: "/pay", label: "Grants Pay", group: "finance" },
      { href: "/intelligence", label: "Reports", group: "finance" },
      { href: "/inbox?tab=team", label: "Team Chat", group: "system" },
      { href: "/more", label: "Systems", group: "system" },
    ];
  }

  if (role === "CUSTOMER_SERVICE") {
    return [
      { href: "/home", label: "Client Care", group: "primary" },
      { href: "/clients", label: "Clients", group: "primary" },
      { href: "/inbox", label: "Inbox", group: "primary" },
      { href: "/work", label: "Queues", group: "ops" },
      { href: "/credit-pulse", label: "Credit Intel", group: "ops" },
      { href: "/inbox?tab=team", label: "Team Chat", group: "system" },
      { href: "/more", label: "More", group: "system" },
    ];
  }

  if (role === "FILE_PREPARER") {
    return [
      { href: "/home", label: "Processing", group: "primary" },
      { href: "/clients", label: "Clients", group: "primary" },
      { href: "/inbox", label: "Inbox", group: "primary" },
      { href: "/work", label: "File Queues", group: "ops" },
      { href: "/credit-pulse", label: "Credit Intel", group: "ops" },
      { href: "/inbox?tab=team", label: "Team Chat", group: "system" },
      { href: "/more", label: "More", group: "system" },
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
    default:
      return "Workspace";
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
    default:
      return role.replaceAll("_", " ");
  }
}
