"use strict";

/**
 * @typedef {{ id: string, title: string, startUrl?: string, partition?: string, allowedHosts?: readonly string[], kind: "os" | "vendor" | "local-trusted" }} Desk
 */

/** Exactly 8 website desks. Chrome renders this array, plus Messages when entitled. */
const DESKS = Object.freeze([
  Object.freeze({
    id: "os",
    title: "Home",
    startUrl: "https://os.grantandconsultants.com/login?gc_shell=app",
    partition: "persist:gc-os",
    allowedHosts: Object.freeze(["os.grantandconsultants.com"]),
    kind: "os",
  }),
  Object.freeze({
    id: "ghl",
    title: "GHL",
    startUrl: "https://app.gohighlevel.com/",
    partition: "persist:gc-ghl",
    allowedHosts: Object.freeze(["app.gohighlevel.com", "accounts.google.com"]),
    kind: "vendor",
  }),
  Object.freeze({
    id: "telegram",
    title: "Telegram",
    startUrl: "https://web.telegram.org/a/",
    partition: "persist:gc-telegram",
    allowedHosts: Object.freeze(["web.telegram.org"]),
    kind: "vendor",
  }),
  Object.freeze({
    id: "experian",
    title: "Experian",
    startUrl: "https://www.experian.com/consumer/upload/",
    partition: "persist:gc-experian",
    allowedHosts: Object.freeze(["www.experian.com"]),
    kind: "vendor",
  }),
  Object.freeze({
    id: "equifax",
    title: "Equifax",
    startUrl: "https://www.equifax.com/personal/credit-report-services/credit-dispute",
    partition: "persist:gc-equifax",
    allowedHosts: Object.freeze(["www.equifax.com"]),
    kind: "vendor",
  }),
  Object.freeze({
    id: "disputefox",
    title: "DisputeFox",
    startUrl: "https://pulse.disputeprocess.com/jsp/client/login.jsp",
    partition: "persist:gc-disputefox",
    allowedHosts: Object.freeze(["pulse.disputeprocess.com"]),
    kind: "vendor",
  }),
  Object.freeze({
    id: "cloud-tax",
    title: "Cloud Tax",
    startUrl: "https://grantandco.cloudtaxoffice.com/proavalon/",
    partition: "persist:gc-cloud-tax",
    allowedHosts: Object.freeze(["grantandco.cloudtaxoffice.com"]),
    kind: "vendor",
  }),
  Object.freeze({
    id: "cfpb",
    title: "CFPB",
    startUrl: "https://www.consumerfinance.gov/complaint/",
    partition: "persist:gc-cfpb",
    allowedHosts: Object.freeze(["www.consumerfinance.gov"]),
    kind: "vendor",
  }),
]);

const MESSAGES_DESK = Object.freeze({
  id: "messages",
  title: "Messages",
  kind: "local-trusted",
});

function deskById(id, desks = DESKS) {
  return desks.find((desk) => desk.id === id) ?? null;
}

function visibleDesks(messagesVisible) {
  return messagesVisible ? [...DESKS, MESSAGES_DESK] : [...DESKS];
}

module.exports = { DESKS, MESSAGES_DESK, deskById, visibleDesks };
