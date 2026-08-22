"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DESKS, deskById } = require("../src/main/desks");
const { unprivilegedWebPreferences, chromeWebPreferences } = require("../src/main/security");

const EXPECTED = [
  ["os", "Home", "https://os.grantandconsultants.com/login?gc_shell=app", "persist:gc-os", ["os.grantandconsultants.com"]],
  ["ghl", "GHL", "https://app.gohighlevel.com/", "persist:gc-ghl", ["app.gohighlevel.com", "accounts.google.com"]],
  ["telegram", "Telegram", "https://web.telegram.org/a/", "persist:gc-telegram", ["web.telegram.org"]],
  ["experian", "Experian", "https://www.experian.com/consumer/upload/", "persist:gc-experian", ["www.experian.com"]],
  ["equifax", "Equifax", "https://www.equifax.com/personal/credit-report-services/credit-dispute", "persist:gc-equifax", ["www.equifax.com"]],
  ["disputefox", "DisputeFox", "https://pulse.disputeprocess.com/jsp/client/login.jsp", "persist:gc-disputefox", ["pulse.disputeprocess.com"]],
  ["cloud-tax", "Cloud Tax", "https://grantandco.cloudtaxoffice.com/proavalon/", "persist:gc-cloud-tax", ["grantandco.cloudtaxoffice.com"]],
  ["cfpb", "CFPB", "https://www.consumerfinance.gov/complaint/", "persist:gc-cfpb", ["www.consumerfinance.gov"]],
];

describe("locked 8-desk sidebar", () => {
  it("exports DESKS.length === 8 with the locked titles and start URLs", () => {
    assert.equal(DESKS.length, 8);
    assert.deepEqual(
      DESKS.map((desk) => desk.id),
      EXPECTED.map((row) => row[0]),
    );
    assert.deepEqual(
      DESKS.map((desk) => desk.title),
      EXPECTED.map((row) => row[1]),
    );
    for (const [id, title, startUrl, partition, hosts] of EXPECTED) {
      const desk = deskById(id);
      assert.ok(desk, id);
      assert.equal(desk.title, title);
      assert.equal(desk.startUrl, startUrl);
      assert.equal(desk.partition, partition);
      assert.deepEqual([...desk.allowedHosts], hosts);
    }
  });

  it("does not export OWNER_NAV or website fallback start URLs", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "src/main/desks.js"), "utf8");
    assert.doesNotMatch(src, /OWNER_NAV|officialLastStepUrl|getDesktopNav/);
    assert.doesNotMatch(src, /Gmail|Dialer|Clients|Inbox|SBTPG|Tasks|TransUnion|Innovis|SmartCredit|Credit Karma|Cognito|Grants Pay|Reports|Settings/);
    for (const desk of DESKS) {
      assert.doesNotMatch(desk.startUrl, /\/credit\/experian|\/team-chat|tab=ghl/);
    }
    const exported = require("../src/main/desks");
    assert.equal(Object.prototype.hasOwnProperty.call(exported, "OWNER_NAV"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(exported, "OFFICIAL"), false);
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
  });
});
