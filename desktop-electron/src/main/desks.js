"use strict";

/**
 * Desktop sidebar catalog. Labels and order match getDesktopNav("OWNER")
 * in src/lib/nav/role-nav.ts. Vendor start URLs come from official-logins.
 * Never load OS portal fallback routes (/inbox?tab=ghl, /credit/experian, …).
 */

const OS_ORIGIN = "https://os.grantandconsultants.com";
const OS_HOST = "os.grantandconsultants.com";
const OS_PARTITION = "persist:gc-os";
const OS_HOME_START_URL = `${OS_ORIGIN}/login?gc_shell=app`;

/** @typedef {"primary" | "ops" | "finance" | "system" | "credit" | "escalations" | "tax"} NavGroup */
/** @typedef {{ href: string, label: string, group?: NavGroup, officialLastStepUrl?: string }} NavItem */
/** @typedef {{ id: string, title: string, href: string, startUrl: string, partition: string, allowedHosts: readonly string[], kind: "os" | "vendor", group?: NavGroup }} Desk */

/** Official https logins from src/lib/nav/official-login-urls.ts + catalogs. */
const OFFICIAL = Object.freeze({
  ghl: "https://app.gohighlevel.com/",
  telegram: "https://web.telegram.org/a/",
  gmail: "https://mail.google.com",
  experian: "https://www.experian.com/consumer/upload/",
  equifax: "https://www.equifax.com/personal/credit-report-services/credit-dispute",
  disputefox: "https://pulse.disputeprocess.com/jsp/client/login.jsp",
  cloudTax: "https://grantandco.cloudtaxoffice.com/proavalon/",
  cfpb: "https://www.consumerfinance.gov/complaint/",
  cognito: "https://www.cognitoforms.com/grantcoconsultants/home",
  transunion: "https://www.transunion.com/credit-disputes/dispute-your-credit",
  innovis: "https://www.innovis.com/personal/disputeResolution",
  smartcredit: "https://www.smartcredit.com/",
  sbtpg: "https://pro.sbtpg.com/login",
});

/**
 * Complete getDesktopNav OWNER list. Source of truth is role-nav.ts;
 * tests assert this catalog stays in lockstep.
 * @type {readonly NavItem[]}
 */
const OWNER_NAV = Object.freeze([
  Object.freeze({ href: "/home", label: "Dashboard", group: "primary" }),
  Object.freeze({ href: "/clients", label: "Clients", group: "primary" }),
  Object.freeze({ href: "/inbox", label: "Inbox", group: "primary", officialLastStepUrl: OFFICIAL.ghl }),
  Object.freeze({ href: "/inbox?tab=ghl", label: "GHL", group: "primary", officialLastStepUrl: OFFICIAL.ghl }),
  Object.freeze({ href: "/inbox?tab=gmail", label: "Gmail", group: "primary", officialLastStepUrl: OFFICIAL.gmail }),
  Object.freeze({ href: "/dialer", label: "Dialer", group: "primary", officialLastStepUrl: OFFICIAL.ghl }),
  Object.freeze({ href: "/team-chat", label: "Telegram", group: "primary", officialLastStepUrl: OFFICIAL.telegram }),
  Object.freeze({ href: "/tax/sbtpg", label: "SBTPG", group: "primary", officialLastStepUrl: OFFICIAL.sbtpg }),
  Object.freeze({ href: "/work", label: "Tasks", group: "ops" }),
  Object.freeze({ href: "/credit/disputefox", label: "DisputeFox", group: "credit", officialLastStepUrl: OFFICIAL.disputefox }),
  Object.freeze({ href: "/credit/experian", label: "Experian", group: "credit", officialLastStepUrl: OFFICIAL.experian }),
  Object.freeze({ href: "/credit/equifax", label: "Equifax", group: "credit", officialLastStepUrl: OFFICIAL.equifax }),
  Object.freeze({ href: "/credit/transunion", label: "TransUnion", group: "credit", officialLastStepUrl: OFFICIAL.transunion }),
  Object.freeze({ href: "/credit/innovis", label: "Innovis", group: "credit", officialLastStepUrl: OFFICIAL.innovis }),
  Object.freeze({ href: "/credit/smartcredit", label: "SmartCredit", group: "credit", officialLastStepUrl: OFFICIAL.smartcredit }),
  Object.freeze({ href: "/credit/credit-karma", label: "Credit Karma", group: "credit" }),
  Object.freeze({ href: "/escalations/cfpb", label: "CFPB", group: "escalations", officialLastStepUrl: OFFICIAL.cfpb }),
  Object.freeze({ href: "/tax/cloud-tax-office", label: "Cloud Tax Office", group: "tax", officialLastStepUrl: OFFICIAL.cloudTax }),
  Object.freeze({ href: "/tax/cognito", label: "Cognito", group: "tax", officialLastStepUrl: OFFICIAL.cognito }),
  Object.freeze({ href: "/pay", label: "Grants Pay", group: "finance" }),
  Object.freeze({ href: "/intelligence", label: "Reports", group: "finance" }),
  Object.freeze({ href: "/acquisition", label: "Acquisition", group: "finance" }),
  Object.freeze({ href: "/automations", label: "Automations", group: "system" }),
  Object.freeze({ href: "/system-health", label: "System Health", group: "system" }),
  Object.freeze({ href: "/agents", label: "Agent Hub", group: "system" }),
  Object.freeze({ href: "/more", label: "Settings", group: "system" }),
]);

function firstPartyOsUrl(href) {
  const url = new URL(href, OS_ORIGIN);
  url.searchParams.set("gc_shell", "app");
  return url.toString();
}

function desktopDeskId(item) {
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
    default:
      return item.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
  }
}

function hostnameOfHttps(urlString) {
  return new URL(urlString).hostname;
}

function deskFromNavItem(item) {
  const id = desktopDeskId(item);
  if (item.officialLastStepUrl) {
    return Object.freeze({
      id,
      title: item.label,
      href: item.href,
      startUrl: item.officialLastStepUrl,
      partition: `persist:gc-${id}`,
      allowedHosts: Object.freeze([hostnameOfHttps(item.officialLastStepUrl)]),
      kind: "vendor",
      group: item.group,
    });
  }
  return Object.freeze({
    id,
    title: item.label,
    href: item.href,
    startUrl: item.href === "/home" ? OS_HOME_START_URL : firstPartyOsUrl(item.href),
    partition: OS_PARTITION,
    allowedHosts: Object.freeze([OS_HOST]),
    kind: "os",
    group: item.group,
  });
}

/** @type {readonly Desk[]} */
const DESKS = Object.freeze(OWNER_NAV.map(deskFromNavItem));

function deskById(id) {
  return DESKS.find((desk) => desk.id === id) ?? null;
}

function navSectionLabel(group) {
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
      const _exhaustive = group;
      void _exhaustive;
      return null;
    }
  }
}

module.exports = {
  DESKS,
  OWNER_NAV,
  OFFICIAL,
  OS_HOME_START_URL,
  OS_ORIGIN,
  OS_HOST,
  OS_PARTITION,
  deskById,
  firstPartyOsUrl,
  desktopDeskId,
  navSectionLabel,
};
