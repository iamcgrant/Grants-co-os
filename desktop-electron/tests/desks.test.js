"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  DESKS,
  OFFICIAL,
  OS_HOME_START_URL,
  OS_HOST,
  OS_PARTITION,
  deskById,
} = require("../src/main/desks");
const { unprivilegedWebPreferences, chromeWebPreferences } = require("../src/main/security");

const EXPECTED = [
  ["os", "Home", OS_HOME_START_URL, OS_HOST],
  ["ghl", "GHL", OFFICIAL.ghl, "app.gohighlevel.com"],
  ["telegram", "Telegram", OFFICIAL.telegram, "web.telegram.org"],
  ["experian", "Experian", OFFICIAL.experian, "www.experian.com"],
  ["equifax", "Equifax", OFFICIAL.equifax, "www.equifax.com"],
  ["disputefox", "DisputeFox", OFFICIAL.disputefox, "pulse.disputeprocess.com"],
  ["cloud-tax", "Cloud Tax", OFFICIAL.cloudTax, "grantandco.cloudtaxoffice.com"],
  ["cfpb", "CFPB", OFFICIAL.cfpb, "www.consumerfinance.gov"],
];

const FORBIDDEN_SIDEBAR = [
  "Gmail",
  "Dialer",
  "Clients",
  "Inbox",
  "SBTPG",
  "Tasks",
  "TransUnion",
  "Innovis",
  "SmartCredit",
  "Credit Karma",
  "Cognito",
  "Pay",
  "Reports",
  "Messages",
];

const FALLBACK_ROUTES = [
  "/inbox?tab=ghl",
  "/team-chat",
  "/credit/experian",
  "/credit/equifax",
  "/credit/disputefox",
  "/escalations/cfpb",
  "/tax/cloud-tax-office",
];

describe("locked 8-desk sidebar", () => {
  it("ships exactly Home plus the seven official vendor desks", () => {
    assert.equal(DESKS.length, 8);
    assert.deepEqual(
      DESKS.map((desk) => desk.id),
      EXPECTED.map((row) => row[0]),
    );
    assert.deepEqual(
      DESKS.map((desk) => desk.title),
      EXPECTED.map((row) => row[1]),
    );
    for (const title of FORBIDDEN_SIDEBAR) {
      assert.equal(
        DESKS.some((desk) => desk.title === title),
        false,
        title,
      );
    }
  });

  it("locks official start URLs and exact provider hosts", () => {
    for (const [id, title, startUrl, host] of EXPECTED) {
      const desk = deskById(id);
      assert.ok(desk, id);
      assert.equal(desk.title, title);
      assert.equal(desk.startUrl, startUrl);
      assert.ok(desk.allowedHosts.includes(host), `${id} missing ${host}`);
      assert.match(desk.partition, /^persist:gc-/);
    }
    const home = deskById("os");
    assert.equal(home.startUrl, "https://os.grantandconsultants.com/login?gc_shell=app");
    assert.deepEqual([...home.allowedHosts], [OS_HOST]);
    assert.equal(home.partition, OS_PARTITION);
    assert.equal(home.kind, "os");
    assert.ok(deskById("ghl").allowedHosts.includes("accounts.google.com"));
  });

  it("never loads OS portal fallback routes as a vendor desk", () => {
    for (const desk of DESKS) {
      if (desk.kind !== "vendor") continue;
      assert.equal(desk.startUrl.startsWith("https://"), true);
      assert.doesNotMatch(desk.startUrl, /os\.grantandconsultants\.com/);
      assert.doesNotMatch(desk.startUrl, /\/credit\/experian/);
      assert.doesNotMatch(desk.startUrl, /tab=ghl/);
      assert.doesNotMatch(desk.startUrl, /\/team-chat/);
      for (const fallback of FALLBACK_ROUTES) {
        const parsed = new URL(desk.startUrl);
        assert.notEqual(parsed.pathname + parsed.search, fallback, `${desk.title} ${fallback}`);
      }
    }
    assert.equal(deskById("experian").startUrl, "https://www.experian.com/consumer/upload/");
    assert.equal(deskById("ghl").startUrl, "https://app.gohighlevel.com/");
    assert.equal(deskById("cfpb").startUrl, "https://www.consumerfinance.gov/complaint/");
  });

  it("gives each vendor its own partition and Home persist:gc-os", () => {
    const vendorPartitions = DESKS.filter((desk) => desk.kind === "vendor").map((desk) => desk.partition);
    assert.equal(new Set(vendorPartitions).size, vendorPartitions.length);
    assert.equal(deskById("os").partition, OS_PARTITION);
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
    assert.match(main, /officialAttempted/);
    assert.match(main, /did-fail-load/);
    assert.doesNotMatch(main, /openExternal: decision\.action === "system-browser"/);
  });
});
