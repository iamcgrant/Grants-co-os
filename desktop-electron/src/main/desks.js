"use strict";

/**
 * Official desks. Vendor / OS Home load unprivileged WebContentsViews.
 * Messages is a trusted local renderer and is never a vendor URL.
 */

/** @typedef {{ id: string, title: string, kind: 'vendor' | 'local-trusted', startUrl?: string, partition?: string, allowedHosts?: readonly string[] }} Desk */

/** @type {readonly Desk[]} */
const VENDOR_DESKS = Object.freeze([
  Object.freeze({
    id: "os",
    title: "OS Home",
    kind: "vendor",
    startUrl: "https://os.grantandconsultants.com/",
    partition: "persist:gc-os",
    allowedHosts: Object.freeze(["os.grantandconsultants.com"]),
  }),
  Object.freeze({
    id: "ghl",
    title: "GHL",
    kind: "vendor",
    startUrl: "https://app.gohighlevel.com/",
    partition: "persist:gc-ghl",
    allowedHosts: Object.freeze(["app.gohighlevel.com"]),
  }),
  Object.freeze({
    id: "telegram",
    title: "Telegram",
    kind: "vendor",
    startUrl: "https://web.telegram.org/a/",
    partition: "persist:gc-telegram",
    allowedHosts: Object.freeze(["web.telegram.org"]),
  }),
  Object.freeze({
    id: "experian",
    title: "Experian",
    kind: "vendor",
    startUrl: "https://www.experian.com/consumer/upload/",
    partition: "persist:gc-experian",
    allowedHosts: Object.freeze(["www.experian.com"]),
  }),
  Object.freeze({
    id: "equifax",
    title: "Equifax",
    kind: "vendor",
    startUrl: "https://www.equifax.com/personal/credit-report-services/credit-dispute",
    partition: "persist:gc-equifax",
    allowedHosts: Object.freeze(["www.equifax.com"]),
  }),
  Object.freeze({
    id: "disputefox",
    title: "DisputeFox",
    kind: "vendor",
    startUrl: "https://pulse.disputeprocess.com/jsp/client/login.jsp",
    partition: "persist:gc-disputefox",
    allowedHosts: Object.freeze(["pulse.disputeprocess.com"]),
  }),
  Object.freeze({
    id: "cloud-tax",
    title: "Cloud Tax",
    kind: "vendor",
    startUrl: "https://grantandco.cloudtaxoffice.com/proavalon/",
    partition: "persist:gc-cloud-tax",
    allowedHosts: Object.freeze(["grantandco.cloudtaxoffice.com"]),
  }),
]);

const MESSAGES_DESK = Object.freeze({
  id: "messages",
  title: "Messages",
  kind: "local-trusted",
});

/** First-wave vendor catalog plus OS Home. Messages is appended only when entitled. */
const DESKS = VENDOR_DESKS;

function deskById(id, desks = DESKS) {
  return desks.find((desk) => desk.id === id) ?? null;
}

function visibleDesks(messagesVisible) {
  return messagesVisible ? [...VENDOR_DESKS, MESSAGES_DESK] : [...VENDOR_DESKS];
}

module.exports = { DESKS, VENDOR_DESKS, MESSAGES_DESK, deskById, visibleDesks };
