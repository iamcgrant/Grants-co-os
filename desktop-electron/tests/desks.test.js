"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DESKS, deskById } = require("../src/main/desks");
const { unprivilegedWebPreferences, chromeWebPreferences } = require("../src/main/security");

const EXPECTED = [
  ["os", "https://os.grantandconsultants.com/", "os.grantandconsultants.com"],
  ["ghl", "https://app.gohighlevel.com/", "app.gohighlevel.com"],
  ["telegram", "https://web.telegram.org/a/", "web.telegram.org"],
  ["experian", "https://www.experian.com/consumer/upload/", "www.experian.com"],
  ["equifax", "https://www.equifax.com/personal/credit-report-services/credit-dispute", "www.equifax.com"],
  ["disputefox", "https://pulse.disputeprocess.com/jsp/client/login.jsp", "pulse.disputeprocess.com"],
  ["cloud-tax", "https://grantandco.cloudtaxoffice.com/proavalon/", "grantandco.cloudtaxoffice.com"],
];

describe("first-wave desks", () => {
  it("ships OS home plus the six approved vendors only", () => {
    assert.deepEqual(
      DESKS.map((desk) => desk.id),
      EXPECTED.map((row) => row[0]),
    );
    assert.equal(DESKS.length, 7);
  });

  it("locks official start URLs and exact allowlist hosts", () => {
    for (const [id, startUrl, host] of EXPECTED) {
      const desk = deskById(id);
      assert.ok(desk, id);
      assert.equal(desk.startUrl, startUrl);
      assert.deepEqual([...desk.allowedHosts], [host]);
      assert.match(desk.partition, /^persist:gc-/);
    }
  });

  it("gives each desk its own persistent partition", () => {
    const partitions = DESKS.map((desk) => desk.partition);
    assert.equal(new Set(partitions).size, partitions.length);
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

describe("spike source invariants", () => {
  const root = path.join(__dirname, "..");

  it("does not embed vendor pages in chrome via iframe or webview", () => {
    const html = fs.readFileSync(path.join(root, "src/chrome/index.html"), "utf8");
    assert.doesNotMatch(html, /<iframe/i);
    assert.doesNotMatch(html, /<webview/i);
    assert.doesNotMatch(html, /os\.grantandconsultants\.com/);
    assert.doesNotMatch(html, /gohighlevel|telegram\.org|experian|equifax|disputeprocess|cloudtaxoffice/i);
  });

  it("titles chrome Grant & Co OS and drops prototype copy", () => {
    const html = fs.readFileSync(path.join(root, "src/chrome/index.html"), "utf8");
    const main = fs.readFileSync(path.join(root, "src/main/index.js"), "utf8");
    assert.match(html, /<title>Grant &amp; Co OS<\/title>/);
    assert.match(main, /title: "Grant & Co OS"/);
    assert.doesNotMatch(html, /Electron spike|OS spike|DISPOSABLE|feasibility|Local chrome only/i);
    assert.doesNotMatch(main, /Electron spike|this spike|This spike/);
    assert.doesNotMatch(html, /id="url-bar"|id="btn-close"|id="btn-forward"/);
    assert.doesNotMatch(html, />Back<|>Reload<|>Close</);
  });

  it("ships local desk monograms and does not fetch remote chrome images", () => {
    const chromeJs = fs.readFileSync(path.join(root, "src/chrome/chrome.js"), "utf8");
    assert.doesNotMatch(chromeJs, /https?:\/\//);
    for (const id of EXPECTED.map((row) => row[0])) {
      const icon = path.join(root, "src/chrome/icons", `${id}.svg`);
      assert.ok(fs.existsSync(icon), icon);
    }
  });

  it("does not implement a grantscoos return or cookie export", () => {
    const main = fs.readFileSync(path.join(root, "src/main/index.js"), "utf8");
    assert.doesNotMatch(main, /setAsDefaultProtocolClient|registerStringProtocol|registerHttpProtocol|registerSchemesAsPrivileged/);
    assert.doesNotMatch(main, /cookies\.get|cookies\.set|ses\.cookies/);
    assert.match(main, /There is no grantscoos/);
    assert.match(main, /WebContentsView/);
    assert.match(main, /unprivilegedWebPreferences/);
  });
});
