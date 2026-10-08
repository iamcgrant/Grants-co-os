"use strict";

/**
 * First-wave desks for the disposable Electron spike.
 * Start URLs are the official login/home constants Charles locked in OS.
 * Do not add Telegram/Equifax/Cloud Tax extras beyond this catalog — they are in.
 * Do not add TransUnion, CFPB, Gmail, Cognito, or other desks in this spike.
 */

/** @typedef {{ id: string, title: string, startUrl: string, partition: string, allowedHosts: readonly string[] }} Desk */

/** @type {readonly Desk[]} */
const DESKS = Object.freeze([
  Object.freeze({
    id: "os",
    title: "OS Home",
    startUrl: "https://os.grantandconsultants.com/login",
    partition: "persist:gc-os",
    allowedHosts: Object.freeze(["os.grantandconsultants.com"]),
  }),
  Object.freeze({
    id: "ghl",
    title: "GHL",
    startUrl: "https://app.gohighlevel.com/",
    partition: "persist:gc-ghl",
    allowedHosts: Object.freeze(["app.gohighlevel.com"]),
  }),
  Object.freeze({
    id: "telegram",
    title: "Telegram",
    startUrl: "https://web.telegram.org/a/",
    partition: "persist:gc-telegram",
    allowedHosts: Object.freeze(["web.telegram.org"]),
  }),
  Object.freeze({
    id: "experian",
    title: "Experian",
    startUrl: "https://www.experian.com/consumer/upload/",
    partition: "persist:gc-experian",
    allowedHosts: Object.freeze(["www.experian.com"]),
  }),
  Object.freeze({
    id: "equifax",
    title: "Equifax",
    startUrl: "https://www.equifax.com/personal/credit-report-services/credit-dispute",
    partition: "persist:gc-equifax",
    allowedHosts: Object.freeze(["www.equifax.com"]),
  }),
  Object.freeze({
    id: "disputefox",
    title: "DisputeFox",
    startUrl: "https://pulse.disputeprocess.com/jsp/client/login.jsp",
    partition: "persist:gc-disputefox",
    allowedHosts: Object.freeze(["pulse.disputeprocess.com"]),
  }),
  Object.freeze({
    id: "cloud-tax",
    title: "Cloud Tax",
    startUrl: "https://grantandco.cloudtaxoffice.com/proavalon/",
    partition: "persist:gc-cloud-tax",
    allowedHosts: Object.freeze(["grantandco.cloudtaxoffice.com"]),
  }),
]);

function deskById(id) {
  return DESKS.find((desk) => desk.id === id) ?? null;
}

module.exports = { DESKS, deskById };
