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
        { href: "/credit", label: "Credit", short: "Credit" },
        { href: "/pay", label: "Pay", short: "Pay" },
        { href: "/agents", label: "Agents", short: "Agents" },
        { href: "/more", label: "More", short: "More" },
      ];
    case "CUSTOMER_SERVICE":
      return [
        { href: "/home", label: "Home", short: "Home" },
        { href: "/clients", label: "Clients", short: "Clients" },
        { href: "/inbox", label: "Inbox", short: "Inbox" },
        { href: "/work", label: "Care", short: "Care" },
        { href: "/credit", label: "Credit", short: "Credit" },
        { href: "/more", label: "More", short: "More" },
      ];
    case "FILE_PREPARER":
      return [
        { href: "/home", label: "Home", short: "Home" },
        { href: "/clients", label: "Clients", short: "Clients" },
        { href: "/inbox", label: "Inbox", short: "Inbox" },
        { href: "/work", label: "Files", short: "Files" },
        { href: "/credit", label: "Credit", short: "Credit" },
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
  if (role === "OWNER" || role === "ADMIN") {
    return [
      { href: "/home", label: "Dashboard", group: "primary" },
      { href: "/clients", label: "Clients", group: "primary" },
      { href: "/inbox", label: "Inbox", group: "primary" },
      { href: "/work", label: "Tasks", group: "ops" },
      { href: "/credit", label: "Credit & Disputes", group: "ops" },
      { href: "/credit-pulse", label: "Friday Pulse", group: "ops" },
      { href: "/work?view=jona", label: "File queues", group: "ops" },
      { href: "/pay", label: "Grants Pay", group: "finance" },
      { href: "/intelligence", label: "Reports", group: "finance" },
      { href: "/acquisition", label: "Acquisition", group: "finance" },
      { href: "/automations", label: "Automations", group: "system" },
      { href: "/system-health", label: "System Health", group: "system" },
      { href: "/team-chat", label: "Team Chat", group: "system" },
      { href: "/agents", label: "Agent Hub", group: "system" },
      { href: "/more", label: "Settings", group: "system" },
    ];
  }

  if (role === "CUSTOMER_SERVICE") {
    return [
      { href: "/home", label: "Client Care", group: "primary" },
      { href: "/clients", label: "Clients", group: "primary" },
      { href: "/inbox", label: "Inbox", group: "primary" },
      { href: "/work", label: "Tasks", group: "ops" },
      { href: "/credit", label: "Credit & Disputes", group: "ops" },
      { href: "/search", label: "Search", group: "system" },
      { href: "/team-chat", label: "Team Chat", group: "system" },
      { href: "/more", label: "Settings", group: "system" },
    ];
  }

  if (role === "FILE_PREPARER") {
    return [
      { href: "/home", label: "Processing", group: "primary" },
      { href: "/clients", label: "Clients", group: "primary" },
      { href: "/inbox", label: "Inbox", group: "primary" },
      { href: "/work", label: "File Queues", group: "ops" },
      { href: "/credit", label: "Credit & Disputes", group: "ops" },
      { href: "/search", label: "Search", group: "system" },
      { href: "/team-chat", label: "Team Chat", group: "system" },
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
