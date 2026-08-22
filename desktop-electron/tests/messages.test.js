"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DESKS, MESSAGES_DESK, visibleDesks } = require("../src/main/desks");
const {
  unprivilegedWebPreferences,
  messagesWebPreferences,
  assertUnprivilegedPrefs,
  assertMessagesPrefs,
} = require("../src/main/security");
const {
  isAllowedOp,
  isUserSendOp,
  isAutonomousOp,
  validateConversationId,
  validateRecipient,
  validateAttachmentPath,
  validateSendText,
  settingsUrl,
} = require("../src/main/messages/ops");
const { senderIsTrusted, validatePayload } = require("../src/main/messages/ipc");
const { redact, safeLog } = require("../src/main/messages/log");
const { isMessagesDeskKilled } = require("../src/main/messages/kill-switch");
const {
  parseEntitlementResponse,
  parseSessionEntitlement,
  entitlementUrl,
  sessionUrl,
  isOsHomeLoginUrl,
  fetchOwnerEntitlement,
} = require("../src/main/messages/entitlement");
const { readPermissionStatus } = require("../src/main/messages/permissions");
const {
  assertNoListenFlags,
  mapOpToArgs,
  baseArgs,
  resolveHelperPath,
  helperEnv,
} = require("../src/main/messages/helper");
const { nextBackoff, createSupervisor } = require("../src/main/messages/supervisor");
const { readOwnerSession, writeOwnerSession, sessionContainsBodies } = require("../src/main/messages/session");
const pin = require("../vendor/platform-imessage.pin.json");

describe("Messages desk isolation", () => {
  it("is not a vendor URL desk and stays hidden without entitlement", () => {
    assert.equal(MESSAGES_DESK.kind, "local-trusted");
    assert.equal(MESSAGES_DESK.startUrl, undefined);
    assert.equal(visibleDesks(false).length, 8);
    assert.equal(visibleDesks(true).length, 9);
    assert.equal(visibleDesks(true).at(-1).id, "messages");
    assert.equal(DESKS.some((desk) => desk.id === "messages"), false);
  });

  it("keeps vendor start URLs unchanged", () => {
    assert.equal(DESKS.find((desk) => desk.id === "ghl").startUrl, "https://app.gohighlevel.com/");
    assert.equal(DESKS.find((desk) => desk.id === "os").startUrl, "https://os.grantandconsultants.com/login?gc_shell=app");
    assert.deepEqual([...DESKS.find((desk) => desk.id === "ghl").allowedHosts], [
      "app.gohighlevel.com",
      "accounts.google.com",
    ]);
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
    assert.equal(isAllowedOp("hydrate"), true);
    assert.equal(isAllowedOp("listen"), false);
    assert.equal(isAllowedOp("export-cookies"), false);
    assert.equal(isUserSendOp("send-text"), true);
    assert.equal(isUserSendOp("list-conversations"), false);
    assert.equal(isAutonomousOp("list-conversations"), true);
    assert.equal(isAutonomousOp("send-text"), false);
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
    const ghl = senderIsTrusted({
      event: { sender: { id: 7, isDestroyed: () => false, getURL: () => "https://app.gohighlevel.com/" } },
      trustedWebContentsId: 7,
      trustedFileUrl: "file:///tmp/messages/index.html",
    });
    assert.equal(ghl, false);
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
    assert.match(sessionUrl(), /\/api\/auth\/me$/);
    assert.equal(Object.hasOwn(helperEnv({ IMESSAGE_CLI_HISTORY_FILE: "/tmp/plain.json" }), "IMESSAGE_CLI_HISTORY_FILE"), false);
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

  it("falls back to /api/auth/me when the signed route is 404 or 501", async () => {
    const calls = [];
    const netFetch = async (url) => {
      calls.push(new URL(url).pathname);
      if (url.includes("/api/desktop/owner-entitlement")) {
        return { status: 404, ok: false, json: async () => ({}) };
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({ user: { role: "OWNER", isActive: true } }),
      };
    };
    const fallback = await fetchOwnerEntitlement({ netFetch, session: {} });
    assert.deepEqual(calls, ["/api/desktop/owner-entitlement", "/api/auth/me"]);
    assert.equal(fallback.entitled, true);
    assert.equal(fallback.source, "session-fallback");
    assert.equal(fallback.role, "OWNER");

    const notImpl = await fetchOwnerEntitlement({
      netFetch: async (url) => {
        if (url.includes("/owner-entitlement")) return { status: 501, ok: false, json: async () => ({}) };
        return { status: 200, ok: true, json: async () => ({ user: { role: "OWNER", isActive: true } }) };
      },
      session: {},
    });
    assert.equal(notImpl.entitled, true);
    assert.equal(notImpl.source, "session-fallback");
  });

  it("does not entitle unauthenticated or non-owner session fallbacks", async () => {
    const unauthenticated = await fetchOwnerEntitlement({
      netFetch: async (url) => {
        if (url.includes("/owner-entitlement")) return { status: 404, ok: false, json: async () => ({}) };
        return { status: 401, ok: false, json: async () => ({ user: null }) };
      },
      session: {},
    });
    assert.equal(unauthenticated.entitled, false);
    assert.equal(unauthenticated.reason, "unauthenticated");

    const staff = await fetchOwnerEntitlement({
      netFetch: async (url) => {
        if (url.includes("/owner-entitlement")) return { status: 404, ok: false, json: async () => ({}) };
        return { status: 200, ok: true, json: async () => ({ user: { role: "ADMIN", isActive: true } }) };
      },
      session: {},
    });
    assert.equal(staff.entitled, false);
    assert.equal(staff.reason, "not-owner");

    const inactive = parseSessionEntitlement({ user: { role: "OWNER", isActive: false } });
    assert.equal(inactive.entitled, false);
    assert.equal(isOsHomeLoginUrl("https://os.grantandconsultants.com/login?gc_shell=app"), true);
    assert.equal(isOsHomeLoginUrl("https://os.grantandconsultants.com/home"), false);
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
    assert.equal(status.needsUserAction, false);
    assert.equal(status.reason, "macos-only");
    assert.match(settingsUrl("accessibility"), /Privacy_Accessibility/);
  });
});

describe("Messages autonomy", () => {
  it("never auto-sends and restarts with backoff after a crash", async () => {
    assert.equal(nextBackoff(0), 1000);
    assert.equal(nextBackoff(1000), 2000);
    assert.equal(nextBackoff(20000), 30000);

    const runs = [];
    let entitled = true;
    let ready = true;
    const events = [];
    let crash = null;
    const helper = {
      run: async (op, payload) => {
        runs.push(op);
        if (op === "send-text") throw new Error("should-not-send");
        return { ok: true, data: op === "list-conversations" ? [{ id: "c1" }] : payload };
      },
      stop() {},
      startWatch() {
        return true;
      },
      onCrash(handler) {
        crash = handler;
        return () => {};
      },
    };
    const scheduled = [];
    const supervisor = createSupervisor({
      helper,
      readPermissionStatus: () => ({ ready, needsUserAction: !ready, reason: ready ? "ok" : "needs-messages-data" }),
      isEntitled: () => entitled,
      isKilled: () => false,
      onEvent: (event) => events.push(event.kind),
      timers: {
        setTimeout: (fn) => {
          scheduled.push(fn);
          return 1;
        },
        clearTimeout: () => {},
        setInterval: () => 1,
        clearInterval: () => {},
      },
    });

    const started = await supervisor.start();
    assert.equal(started.ok, true);
    assert.ok(runs.includes("list-conversations"));
    const blocked = await supervisor.autonomousRun("send-text", { recipient: "+15551234567", text: "nope" });
    assert.equal(blocked.reason, "autonomous-send-forbidden");
    assert.ok(!runs.includes("send-text"));

    crash({ code: 1 });
    assert.equal(scheduled.length, 1);
    await scheduled[0]();
    assert.ok(runs.filter((op) => op === "list-conversations").length >= 2);

    ready = false;
    entitled = true;
    const helperStops = [];
    const watching = createSupervisor({
      helper: { ...helper, stop: () => helperStops.push("stop") },
      readPermissionStatus: () => ({ ready: false, needsUserAction: true, reason: "needs-messages-data" }),
      isEntitled: () => true,
      isKilled: () => false,
      onEvent: (event) => events.push(event.kind),
      timers: {
        setTimeout: () => 1,
        clearTimeout: () => {},
        setInterval: () => 1,
        clearInterval: () => {},
      },
    });
    const denied = await watching.start();
    assert.equal(denied.ok, false);
    assert.ok(events.includes("permissions"));
  });

  it("remembers only the owner Messages tab, never message bodies", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gc-msg-session-"));
    const saved = writeOwnerSession(dir, {
      lastDeskId: "messages",
      lastConversationId: "chat;+;+15551212",
      text: "should-not-persist",
    });
    assert.equal(saved.lastDeskId, "messages");
    assert.equal(saved.lastConversationId, "chat;+;+15551212");
    assert.equal(sessionContainsBodies(saved), false);
    const read = readOwnerSession(dir);
    assert.equal(read.lastDeskId, "messages");
    assert.equal(JSON.stringify(read).includes("should-not-persist"), false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reconnects after wake without sending", async () => {
    const runs = [];
    const supervisor = createSupervisor({
      helper: {
        run: async (op) => {
          runs.push(op);
          return { ok: true, data: [] };
        },
        stop() {
          runs.push("stop");
        },
        startWatch() {
          return true;
        },
        onCrash() {
          return () => {};
        },
      },
      readPermissionStatus: () => ({ ready: true, reason: "ok" }),
      isEntitled: () => true,
      isKilled: () => false,
      timers: {
        setTimeout: () => 1,
        clearTimeout: () => {},
        setInterval: () => 1,
        clearInterval: () => {},
      },
    });
    await supervisor.reconnect("wake");
    assert.ok(runs.includes("stop"));
    assert.ok(runs.includes("list-conversations"));
    assert.ok(!runs.includes("send-text"));
    assert.ok(!runs.includes("reply"));
  });
});

describe("Messages source invariants", () => {
  const root = path.join(__dirname, "..");

  it("does not open ports or talk to Beeper cloud", () => {
    const helper = fs.readFileSync(path.join(root, "src/main/messages/helper.js"), "utf8");
    const main = fs.readFileSync(path.join(root, "src/main/index.js"), "utf8");
    const supervisor = fs.readFileSync(path.join(root, "src/main/messages/supervisor.js"), "utf8");
    const entitlement = fs.readFileSync(path.join(root, "src/main/messages/entitlement.js"), "utf8");
    assert.doesNotMatch(helper, /createServer|net\.createServer|new WebSocket|beeper\.com|matrix\.org/i);
    assert.doesNotMatch(supervisor, /send-text|auto-reply|auto-send/);
    assert.doesNotMatch(main, /cookies\.get|cookies\.set|ses\.cookies/);
    assert.doesNotMatch(entitlement, /cookies\.get|cookies\.set|ses\.cookies/);
    assert.match(entitlement, /\/api\/auth\/me/);
    assert.match(main, /There is no grantscoos/);
    assert.match(main, /messagesTrusted/);
    assert.match(main, /startOwnerAutonomy/);
    assert.match(main, /powerMonitor/);
    assert.match(main, /isOsHomeLoginUrl/);
    assert.match(main, /did-navigate/);
    const messagesHtml = fs.readFileSync(path.join(root, "src/messages/index.html"), "utf8");
    assert.doesNotMatch(messagesHtml, /type="password"|BlueBubbles|AirMessage|pypush/i);
    assert.match(messagesHtml, /does not ask for/);
  });
});
