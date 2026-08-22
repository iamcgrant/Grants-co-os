"use strict";

/**
 * Official Grant & Co OS desktop sidebar — exactly these 8 desks.
 * Do not add Gmail, Dialer, Clients, Inbox, SBTPG, Tasks, TransUnion,
 * Innovis, SmartCredit, Credit Karma, Cognito, Pay, Reports, or Messages.
 * Never load OS portal fallback routes as a desk start URL.
 */

const OS_ORIGIN = "https://os.grantandconsultants.com";
const OS_HOST = "os.grantandconsultants.com";
const OS_PARTITION = "persist:gc-os";
const OS_HOME_START_URL = `${OS_ORIGIN}/login?gc_shell=app`;

/** Official https logins from src/lib/nav/official-login-urls.ts + catalogs. */
const OFFICIAL = Object.freeze({
  ghl: "https://app.gohighlevel.com/",
  telegram: "https://web.telegram.org/a/",
  experian: "https://www.experian.com/consumer/upload/",
  equifax: "https://www.equifax.com/personal/credit-report-services/credit-dispute",
  disputefox: "https://pulse.disputeprocess.com/jsp/client/login.jsp",
  cloudTax: "https://grantandco.cloudtaxoffice.com/proavalon/",
  cfpb: "https://www.consumerfinance.gov/complaint/",
});

/**
 * Exact provider host plus only the IdP host required for that vendor login.
 * GHL Google sign-in leaves app.gohighlevel.com for accounts.google.com.
 * Other desks keep login on the official start host.
 *
 * @typedef {{ id: string, title: string, startUrl: string, partition: string, allowedHosts: readonly string[], kind: "os" | "vendor" }} Desk
 */

/** @type {readonly Desk[]} */
const DESKS = Object.freeze([
  Object.freeze({
    id: "os",
    title: "Home",
    startUrl: OS_HOME_START_URL,
    partition: OS_PARTITION,
    allowedHosts: Object.freeze([OS_HOST]),
    kind: "os",
  }),
  Object.freeze({
    id: "ghl",
    title: "GHL",
    startUrl: OFFICIAL.ghl,
    partition: "persist:gc-ghl",
    allowedHosts: Object.freeze(["app.gohighlevel.com", "accounts.google.com"]),
    kind: "vendor",
  }),
  Object.freeze({
    id: "telegram",
    title: "Telegram",
    startUrl: OFFICIAL.telegram,
    partition: "persist:gc-telegram",
    allowedHosts: Object.freeze(["web.telegram.org"]),
    kind: "vendor",
  }),
  Object.freeze({
    id: "experian",
    title: "Experian",
    startUrl: OFFICIAL.experian,
    partition: "persist:gc-experian",
    allowedHosts: Object.freeze(["www.experian.com"]),
    kind: "vendor",
  }),
  Object.freeze({
    id: "equifax",
    title: "Equifax",
    startUrl: OFFICIAL.equifax,
    partition: "persist:gc-equifax",
    allowedHosts: Object.freeze(["www.equifax.com"]),
    kind: "vendor",
  }),
  Object.freeze({
    id: "disputefox",
    title: "DisputeFox",
    startUrl: OFFICIAL.disputefox,
    partition: "persist:gc-disputefox",
    allowedHosts: Object.freeze(["pulse.disputeprocess.com"]),
    kind: "vendor",
  }),
  Object.freeze({
    id: "cloud-tax",
    title: "Cloud Tax",
    startUrl: OFFICIAL.cloudTax,
    partition: "persist:gc-cloud-tax",
    allowedHosts: Object.freeze(["grantandco.cloudtaxoffice.com"]),
    kind: "vendor",
  }),
  Object.freeze({
    id: "cfpb",
    title: "CFPB",
    startUrl: OFFICIAL.cfpb,
    partition: "persist:gc-cfpb",
    allowedHosts: Object.freeze(["www.consumerfinance.gov"]),
    kind: "vendor",
  }),
]);

function deskById(id) {
  return DESKS.find((desk) => desk.id === id) ?? null;
}

module.exports = {
  DESKS,
  OFFICIAL,
  OS_HOME_START_URL,
  OS_ORIGIN,
  OS_HOST,
  OS_PARTITION,
  deskById,
};
