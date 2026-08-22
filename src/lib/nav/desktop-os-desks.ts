import { getDesktopNav, type NavGroup, type NavItem } from "@/lib/nav/role-nav";

export const OS_DESKTOP_ORIGIN = "https://os.grantandconsultants.com";
export const OS_DESKTOP_HOST = "os.grantandconsultants.com";
export const OS_DESKTOP_PARTITION = "persist:gc-os";
export const OS_HOME_START_URL = `${OS_DESKTOP_ORIGIN}/login?gc_shell=app`;

export type DesktopDeskKind = "os" | "vendor";

export type DesktopOsDesk = {
  id: string;
  title: string;
  href: string;
  startUrl: string;
  partition: string;
  allowedHosts: readonly string[];
  kind: DesktopDeskKind;
  group?: NavGroup;
};

export function firstPartyOsUrl(href: string): string {
  const url = new URL(href, OS_DESKTOP_ORIGIN);
  url.searchParams.set("gc_shell", "app");
  return url.toString();
}

export function desktopDeskId(item: NavItem): string {
  if (item.href === "/home") return "os";
  switch (item.label) {
    case "Cloud Tax Office":
      return "cloud-tax";
    case "Grants Pay":
      return "pay";
    case "Agent Hub":
      return "agents";
    case "System Health":
      return "system-health";
    default: {
      return item.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }
  }
}

export function hostnameOfHttps(urlString: string): string {
  return new URL(urlString).hostname;
}

export function deskFromNavItem(item: NavItem): DesktopOsDesk {
  const id = desktopDeskId(item);
  if (item.officialLastStepUrl) {
    return {
      id,
      title: item.label,
      href: item.href,
      startUrl: item.officialLastStepUrl,
      partition: `persist:gc-${id}`,
      allowedHosts: [hostnameOfHttps(item.officialLastStepUrl)],
      kind: "vendor",
      group: item.group,
    };
  }
  return {
    id,
    title: item.label,
    href: item.href,
    startUrl: item.href === "/home" ? OS_HOME_START_URL : firstPartyOsUrl(item.href),
    partition: OS_DESKTOP_PARTITION,
    allowedHosts: [OS_DESKTOP_HOST],
    kind: "os",
    group: item.group,
  };
}

export function getOwnerDesktopDesks(): DesktopOsDesk[] {
  return getDesktopNav("OWNER").map(deskFromNavItem);
}
