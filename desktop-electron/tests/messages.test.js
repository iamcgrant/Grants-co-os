"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { VENDOR_DESKS, MESSAGES_DESK, visibleDesks } = require("../src/main/desks");
const { unprivilegedWebPreferences, messagesWebPreferences, assertUnprivilegedPrefs, assertMessagesPrefs } = require("../src/main/security");
const { isAllowedOp, validateConversationId, validateRecipient, validateAttachmentPath, validateSendText, settingsUrl } = require("../src/main/messages/ops");
const { senderIsTrusted, validatePayload } = require("../src/main/messages/ipc");
const { redact, safeLog } = require("../src/main/messages/log");
const { isMessagesDeskKilled } = require("../src/main/messages/kill-switch");
const { parseEntitlementResponse, entitlementUrl } = require("../src/main/messages/entitlement");
const { readPermissionStatus } = require("../src/main/messages/permissions");
const { assertNoListenFlags, mapOpToArgs, baseArgs, resolveHelperPath } = require("../src/main/messages/helper");
const pin = require("../vendor/platform-imessage.pin.json");

describe("Messages desk isolation", () => {
  it("is not a vendor URL desk and stays hidden without entitlement", () => {
    assert.equal(MESSAGES_DESK.kind, "local-trusted");
    assert.equal(MESSAGES_DESK.startUrl, undefined);
    assert.equal(visibleDesks(false).some((desk) => desk.id === "messages"), false);
    assert.equal(visibleDesks(true).at(-1).id, "messages");
    assert.equal(VENDOR_DESKS.some((desk) => desk.id === "messages"), false);
  });

  it("never gives vendor/OS prefs a Messages preload", () => {
    const vendor = unprivilegedWebPreferences("persist:gc-os");
    assertUnprivilegedPrefs(vendor);
    const messages = messagesWebPreferences("/tmp/messages-preload.js");
    assertMessagesPrefs(messages);
    assert.notEqual(messages.partition, vendor.partition);
  });
});

describe("Messages IPC validation", () => {
  it("allows only the documented operations", () => {
    assert.equal(isAllowedOp("send-text"), true);
    assert.equal(isAllowedOp("listen"), false);
    assert.equal(isAllowedOp("export-cookies"), false);
  });

  it("validates conversation, recipient, and attachment path", () => {
    assert.equal(validateConversationId("chat;+;+15551212"), "chat;+;+15551212");
    assert.equal(validateConversationId("../etc/passwd"), null);
    assert.equal(validateRecipient("+15551234567"), "+15551234567");
    assert.equal(validateRecipient("owner@example.com"), "owner@example.com");
    assert.equal(validateRecipient("https://evil.example"), null);
    const file = path.join(os.tmpdir(), "gc-os-attach.txt");
    fs.writeFileSync(file, "x");
    assert.equal(
      validateAttachmentPath(file, { existsSync: fs.existsSync, isAbsolute: path.isAbsolute }),
      file,
    );
    assert.equal(
      validateAttachmentPath("../secret.png", { existsSync: () => true, isAbsolute: path.isAbsolute }),
      null,
    );
    fs.unlinkSync(file);
  });

  it("rejects untrusted senders and unknown ops", () => {
    const trusted = senderIsTrusted({
      event: { sender: { id: 7, isDestroyed: () => false, getURL: () => "file:///tmp/messages/index.html" } },
      trustedWebContentsId: 7,
      trustedFileUrl: "file:///tmp/messages/index.html",
    });
    assert.equal(trusted, true);
    const vendor = senderIsTrusted({
      event: { sender: { id: 8, isDestroyed: () => false, getURL: () => "https://os.grantandconsultants.com/" } },
      trustedWebContentsId: 8,
      trustedFileUrl: "file:///tmp/messages/index.html",
    });
    assert.equal(vendor, false);
    assert.equal(validatePayload("export", {}, fs).ok, false);
    assert.equal(validateSendText({ recipient: "+15551234567", text: "hi" }).recipient, "+15551234567");
  });
});

describe("Messages helper and entitlement", () => {
  it("pins the audited Beeper commit and forbids listeners", () => {
    assert.equal(pin.pinnedRef, "cda1545b87db4aeb2ec266bd8f9f335eec67c323");
    assert.equal(pin.license, "MIT");
    assert.throws(() => assertNoListenFlags(["--listen", "8080"]));
    assert.doesNotThrow(() => assertNoListenFlags(["--json", "chats"]));
    assert.deepEqual(mapOpToArgs("list-conversations", {}), ["chats"]);
    assert.ok(baseArgs("/tmp/cache").includes("--no-use-secondary-instance"));
    assert.equal(resolveHelperPath("/missing", { existsSync: () => false }), null);
    assert.match(entitlementUrl(), /\/api\/desktop\/owner-entitlement$/);
  });

  it("does not treat renderer flags as entitlement", () => {
    assert.deepEqual(parseEntitlementResponse({ entitled: true, role: "OWNER" }), {
      entitled: false,
      reason: "expired",
    });
    const exp = new Date(Date.now() + 60_000).toISOString();
    const ok = parseEntitlementResponse({
      entitled: true,
      role: "OWNER",
      purpose: "desktop-messages-owner",
      aud: "com.grantandconsultants.os",
      exp,
      entitlement: "token",
    });
    assert.equal(ok.entitled, true);
    assert.equal(parseEntitlementResponse({ entitled: true, role: "ADMIN", exp }).entitled, false);
  });

  it("hides the desk when the kill switch is on and never logs message text", () => {
    assert.equal(isMessagesDeskKilled({ env: { GC_MESSAGES_DESK: "0" } }), true);
    assert.equal(isMessagesDeskKilled({ env: {} }), false);
    assert.equal(redact({ text: "secret hello", op: "send-text" }).text, "[redacted]");
    const lines = [];
    const orig = console.log;
    console.log = (line) => lines.push(String(line));
    safeLog("info", "send", { text: "do-not-print-this" });
    console.log = orig;
    assert.ok(lines.every((line) => !line.includes("do-not-print-this")));
  });

  it("does not start permission work on Linux and opens Settings URLs only", () => {
    const status = readPermissionStatus({ platform: "linux" });
    assert.equal(status.ready, false);
    assert.equal(status.reason, "macos-only");
    assert.match(settingsUrl("accessibility"), /Privacy_Accessibility/);
  });
});

describe("Messages source invariants", () => {
  const root = path.join(__dirname, "..");

  it("does not open ports or talk to Beeper cloud", () => {
    const helper = fs.readFileSync(path.join(root, "src/main/messages/helper.js"), "utf8");
    const main = fs.readFileSync(path.join(root, "src/main/index.js"), "utf8");
    assert.doesNotMatch(helper, /createServer|net\.createServer|new WebSocket|beeper\.com|matrix\.org/i);
    assert.doesNotMatch(main, /cookies\.get|cookies\.set|ses\.cookies/);
    assert.match(main, /There is no grantscoos/);
    assert.match(main, /messagesTrusted/);
    const messagesHtml = fs.readFileSync(path.join(root, "src/messages/index.html"), "utf8");
    assert.doesNotMatch(messagesHtml, /type="password"|BlueBubbles|AirMessage|pypush/i);
    assert.match(messagesHtml, /does not ask for/);
  });
});
