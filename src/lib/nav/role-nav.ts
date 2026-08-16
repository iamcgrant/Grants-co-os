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
};

/** Role-aware primary navigation — progressive disclosure of OS modules */
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
    case "MANAGER":
      return [
        { href: "/home", label: "Home", short: "Home" },
        { href: "/clients", label: "Clients", short: "Clients" },
        { href: "/inbox", label: "Inbox", short: "Inbox" },
        { href: "/work", label: "Work", short: "Work" },
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
