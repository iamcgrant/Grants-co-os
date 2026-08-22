"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  DESKS,
  OWNER_NAV,
  OFFICIAL,
  OS_HOME_START_URL,
  OS_HOST,
  OS_PARTITION,
  deskById,
} = require("../src/main/desks");
const { unprivilegedWebPreferences, chromeWebPreferences } = require("../src/main/security");

const FALLBACK_ROUTES = [
  "/inbox?tab=ghl",
  "/inbox?tab=gmail",
  "/team-chat",
  "/credit/experian",
  "/credit/equifax",
  "/credit/disputefox",
  "/credit/transunion",
  "/escalations/cfpb",
  "/tax/cloud-tax-office",
];

const LOCKED_VENDORS = [
  ["ghl", OFFICIAL.ghl, "app.gohighlevel.com"],
  ["telegram", OFFICIAL.telegram, "web.telegram.org"],
  ["experian", OFFICIAL.experian, "www.experian.com"],
  ["equifax", OFFICIAL.equifax, "www.equifax.com"],
  ["disputefox", OFFICIAL.disputefox, "pulse.disputeprocess.com"],
  ["cloud-tax", OFFICIAL.cloudTax, "grantandco.cloudtaxoffice.com"],
  ["cfpb", OFFICIAL.cfpb, "www.consumerfinance.gov"],
  ["gmail", OFFICIAL.gmail, "mail.google.com"],
  ["cognito", OFFICIAL.cognito, "www.cognitoforms.com"],
];

describe("owner desktop catalog", () => {
  it("ships the complete OWNER sidebar, not a six-vendor subset", () => {
    assert.equal(DESKS.length, OWNER_NAV.length);
    assert.ok(DESKS.length > 8);
    assert.deepEqual(
      DESKS.map((desk) => desk.title),
      OWNER_NAV.map((item) => item.label),
    );
  });

  it("starts OS Home on the first-party login with gc_shell=app", () => {
    const home = deskById("os");
    assert.ok(home);
    assert.equal(home.startUrl, OS_HOME_START_URL);
    assert.equal(home.startUrl, "https://os.grantandconsultants.com/login?gc_shell=app");
    assert.deepEqual([...home.allowedHosts], [OS_HOST]);
    assert.equal(home.partition, OS_PARTITION);
    assert.equal(home.kind, "os");
  });

  it("loads first-party OS pages on os.grantandconsultants.com with gc_shell=app", () => {
    const firstParty = DESKS.filter((desk) => desk.kind === "os" && desk.id !== "os");
    assert.ok(firstParty.length > 0);
    for (const desk of firstParty) {
      assert.match(desk.startUrl, /^https:\/\/os\.grantandconsultants\.com\//);
      assert.match(desk.startUrl, /[?&]gc_shell=app/);
      assert.equal(desk.partition, OS_PARTITION);
      assert.deepEqual([...desk.allowedHosts], [OS_HOST]);
    }
    const clients = deskById("clients");
    assert.equal(clients.startUrl, "https://os.grantandconsultants.com/clients?gc_shell=app");
    const karma = deskById("credit-karma");
    assert.equal(
      karma.startUrl,
      "https://os.grantandconsultants.com/credit/credit-karma?gc_shell=app",
    );
  });

  it("loads locked vendor desks at official https URLs, never OS fallback routes", () => {
    for (const [id, startUrl, host] of LOCKED_VENDORS) {
      const desk = deskById(id);
      assert.ok(desk, id);
      assert.equal(desk.startUrl, startUrl);
      assert.equal(desk.kind, "vendor");
      assert.deepEqual([...desk.allowedHosts], [host]);
      assert.equal(desk.partition, `persist:gc-${id}`);
      assert.equal(desk.startUrl.startsWith("https://"), true);
      assert.doesNotMatch(desk.startUrl, /os\.grantandconsultants\.com/);
    }
    for (const desk of DESKS) {
      if (desk.kind !== "vendor") continue;
      for (const fallback of FALLBACK_ROUTES) {
        assert.notEqual(
          new URL(desk.startUrl).pathname + new URL(desk.startUrl).search,
          fallback,
          `${desk.title} must not load ${fallback}`,
        );
      }
      assert.doesNotMatch(desk.startUrl, /\/credit\/experian/);
      assert.doesNotMatch(desk.startUrl, /tab=ghl/);
    }
  });

  it("gives vendor desks their own partitions and shares persist:gc-os for first-party pages", () => {
    const vendorPartitions = DESKS.filter((desk) => desk.kind === "vendor").map((desk) => desk.partition);
    assert.equal(new Set(vendorPartitions).size, vendorPartitions.length);
    const osPartitions = DESKS.filter((desk) => desk.kind === "os").map((desk) => desk.partition);
    assert.ok(osPartitions.every((partition) => partition === OS_PARTITION));
  });
});

describe("renderer privileges", () => {
  it("sandboxes vendor/OS prefs and omits preload", () => {
    const prefs = unprivilegedWebPreferences("persist:gc-ghl");
    assert.equal(prefs.nodeIntegration, false);
    assert.equal(prefs.contextIsolation, true);
    assert.equal(prefs.sandbox, true);
    assert.equal(Object.prototype.hasOwnProperty.call(prefs, "preload"), false);
  });

  it("keeps chrome sandboxed and isolated even with a chrome-only preload", () => {
    const prefs = chromeWebPreferences("/tmp/preload.js");
    assert.equal(prefs.nodeIntegration, false);
    assert.equal(prefs.contextIsolation, true);
    assert.equal(prefs.sandbox, true);
    assert.equal(prefs.preload, "/tmp/preload.js");
    assert.equal(prefs.partition, "gc-chrome-local");
  });
});

describe("desktop chrome invariants", () => {
  const root = path.join(__dirname, "..");

  it("does not embed vendor pages in chrome via iframe or webview", () => {
    const html = fs.readFileSync(path.join(root, "src/chrome/index.html"), "utf8");
    assert.doesNotMatch(html, /<iframe/i);
    assert.doesNotMatch(html, /<webview/i);
    assert.doesNotMatch(html, /os\.grantandconsultants\.com/);
    assert.doesNotMatch(html, /gohighlevel|telegram\.org|experian|equifax|disputeprocess|cloudtaxoffice/i);
    assert.doesNotMatch(html, /url-bar|address bar/i);
    assert.doesNotMatch(html, /spike|prototype|Electron/i);
    assert.match(html, /Grant &amp; Co OS/);
  });

  it("does not implement a grantscoos return or cookie export", () => {
    const main = fs.readFileSync(path.join(root, "src/main/index.js"), "utf8");
    assert.doesNotMatch(main, /setAsDefaultProtocolClient|registerStringProtocol|registerHttpProtocol|registerSchemesAsPrivileged/);
    assert.doesNotMatch(main, /cookies\.get|cookies\.set|ses\.cookies/);
    assert.match(main, /There is no grantscoos/);
    assert.match(main, /WebContentsView/);
    assert.match(main, /unprivilegedWebPreferences/);
    assert.match(main, /Grant & Co OS/);
    assert.doesNotMatch(main, /Electron spike|prototype/i);
  });
});
