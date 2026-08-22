/** Locked Electron sidebar — exactly these 8 desks. Not getDesktopNav(OWNER). */

export const OS_DESKTOP_ORIGIN = "https://os.grantandconsultants.com";
export const OS_DESKTOP_HOST = "os.grantandconsultants.com";
export const OS_DESKTOP_PARTITION = "persist:gc-os";
export const OS_HOME_START_URL = `${OS_DESKTOP_ORIGIN}/login?gc_shell=app`;

export type DesktopDeskKind = "os" | "vendor";

export type ElectronDesktopDesk = {
  id: string;
  title: string;
  startUrl: string;
  partition: string;
  allowedHosts: readonly string[];
  kind: DesktopDeskKind;
};

export const ELECTRON_SIDEBAR_DESKS: readonly ElectronDesktopDesk[] = [
  {
    id: "os",
    title: "Home",
    startUrl: OS_HOME_START_URL,
    partition: OS_DESKTOP_PARTITION,
    allowedHosts: [OS_DESKTOP_HOST],
    kind: "os",
  },
  {
    id: "ghl",
    title: "GHL",
    startUrl: "https://app.gohighlevel.com/",
    partition: "persist:gc-ghl",
    allowedHosts: ["app.gohighlevel.com", "accounts.google.com"],
    kind: "vendor",
  },
  {
    id: "telegram",
    title: "Telegram",
    startUrl: "https://web.telegram.org/a/",
    partition: "persist:gc-telegram",
    allowedHosts: ["web.telegram.org"],
    kind: "vendor",
  },
  {
    id: "experian",
    title: "Experian",
    startUrl: "https://www.experian.com/consumer/upload/",
    partition: "persist:gc-experian",
    allowedHosts: ["www.experian.com"],
    kind: "vendor",
  },
  {
    id: "equifax",
    title: "Equifax",
    startUrl: "https://www.equifax.com/personal/credit-report-services/credit-dispute",
    partition: "persist:gc-equifax",
    allowedHosts: ["www.equifax.com"],
    kind: "vendor",
  },
  {
    id: "disputefox",
    title: "DisputeFox",
    startUrl: "https://pulse.disputeprocess.com/jsp/client/login.jsp",
    partition: "persist:gc-disputefox",
    allowedHosts: ["pulse.disputeprocess.com"],
    kind: "vendor",
  },
  {
    id: "cloud-tax",
    title: "Cloud Tax",
    startUrl: "https://grantandco.cloudtaxoffice.com/proavalon/",
    partition: "persist:gc-cloud-tax",
    allowedHosts: ["grantandco.cloudtaxoffice.com"],
    kind: "vendor",
  },
  {
    id: "cfpb",
    title: "CFPB",
    startUrl: "https://www.consumerfinance.gov/complaint/",
    partition: "persist:gc-cfpb",
    allowedHosts: ["www.consumerfinance.gov"],
    kind: "vendor",
  },
];

export function getElectronSidebarDesks(): readonly ElectronDesktopDesk[] {
  return ELECTRON_SIDEBAR_DESKS;
}
