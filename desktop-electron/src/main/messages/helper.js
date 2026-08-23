"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { safeLog } = require("./log");
const pin = require("../../../vendor/platform-imessage.pin.json");

const HELPER_NAME = "imessage-cli";
const EXPECTED_PIN = pin.pinnedRef;

function helperBinaryCandidates(extraResourcesPath) {
  return [
    extraResourcesPath ? path.join(extraResourcesPath, "messages-helper", HELPER_NAME) : null,
    path.join(__dirname, "..", "..", "..", "native", "messages-helper", "bin", HELPER_NAME),
  ].filter(Boolean);
}

function resolveHelperPath(extraResourcesPath, { existsSync } = fs) {
  for (const candidate of helperBinaryCandidates(extraResourcesPath)) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function cacheDir(userData) {
  return path.join(userData, "messages-helper-cache");
}

function assertNoListenFlags(args) {
  const joined = args.join(" ");
  if (/(?:--listen|--port|--host|--http|--ws|--websocket|--bind|--serve)/i.test(joined)) {
    throw new Error("helper argv rejected");
  }
}

function mapOpToArgs(op, payload) {
  switch (op) {
    case "active-account":
      return ["current-user"];
    case "list-conversations":
      return ["chats"];
    case "load-messages":
      return ["messages", payload.conversationId];
    case "send-text":
      return ["send", payload.recipient, payload.text];
    case "send-attachment":
      return ["send-file", payload.recipient, payload.attachmentPath];
    case "reply":
      return ["reply", payload.conversationId, payload.messageId, payload.text];
    case "react":
      return ["react", payload.conversationId, payload.messageId, payload.reaction];
    case "mark-read":
      return ["mark-read", payload.conversationId];
    case "search":
      return ["search", payload.query];
    case "open-in-apple-messages":
      return ["select-chat", payload.conversationId];
    case "version":
      return ["version"];
    default: {
      const _exhaustive = op;
      void _exhaustive;
      return null;
    }
  }
}

function baseArgs(dataDir) {
  return [
    "--json",
    "--no-events",
    "--no-use-secondary-instance",
    "--data-dir",
    dataDir,
  ];
}

function createHelper({
  userData,
  extraResourcesPath,
  spawnFn = spawn,
  existsSync = fs.existsSync,
  rmSync = fs.rmSync,
  mkdirSync = fs.mkdirSync,
  platform = process.platform,
} = {}) {
  let child = null;
  let killed = false;

  function ensureCache() {
    const dir = cacheDir(userData);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  function binary() {
    return resolveHelperPath(extraResourcesPath, { existsSync });
  }

  function available() {
    return platform === "darwin" && Boolean(binary());
  }

  function stop() {
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
    child = null;
  }

  function disconnect() {
    stop();
    const dir = cacheDir(userData);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
    killed = true;
    safeLog("info", "helper-disconnected", { cacheCleared: true });
  }

  function run(op, payload) {
    if (killed) {
      return Promise.resolve({ ok: false, reason: "disconnected" });
    }
    if (!available()) {
      return Promise.resolve({ ok: false, reason: "helper-missing" });
    }
    const mapped = mapOpToArgs(op, payload || {});
    if (!mapped) {
      return Promise.resolve({ ok: false, reason: "unsupported-op" });
    }
    const args = [...baseArgs(ensureCache()), ...mapped];
    assertNoListenFlags(args);
    safeLog("info", "helper-spawn", { op, argc: args.length });

    return new Promise((resolve) => {
      const proc = spawnFn(binary(), args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          IMESSAGE_CLI_HISTORY_FILE: "",
        },
      });
      let stdout = "";
      let stderr = "";
      proc.stdout?.on("data", (chunk) => {
        stdout += String(chunk);
      });
      proc.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });
      proc.on("error", () => {
        resolve({ ok: false, reason: "helper-spawn-failed" });
      });
      proc.on("close", (code) => {
        if (stderr) safeLog("error", "helper-stderr", { bytes: stderr.length, op });
        if (code !== 0) {
          resolve({ ok: false, reason: "helper-exit", code });
          return;
        }
        try {
          resolve({ ok: true, data: stdout ? JSON.parse(stdout) : null });
        } catch {
          resolve({ ok: true, data: { raw: true, bytes: stdout.length } });
        }
      });
    });
  }

  function subscribe(onTick) {
    if (!available() || killed) return () => {};
    const timer = setInterval(() => {
      run("list-conversations", {}).then((result) => {
        if (result.ok) onTick(result.data);
      });
    }, 4000);
    return () => clearInterval(timer);
  }

  function openAppleMessages() {
    if (platform !== "darwin") return false;
    spawnFn("open", ["-a", "Messages"], { stdio: "ignore" });
    return true;
  }

  function pinSha() {
    return EXPECTED_PIN;
  }

  function versionCheck(output) {
    const text = String(output || "");
    return { ok: Boolean(text.trim()), helper: HELPER_NAME, pin: EXPECTED_PIN };
  }

  return {
    available,
    binary,
    run,
    stop,
    disconnect,
    subscribe,
    openAppleMessages,
    pinSha,
    versionCheck,
    cacheDir: () => cacheDir(userData),
    home: () => os.homedir(),
  };
}

module.exports = {
  HELPER_NAME,
  EXPECTED_PIN,
  helperBinaryCandidates,
  resolveHelperPath,
  cacheDir,
  assertNoListenFlags,
  mapOpToArgs,
  baseArgs,
  createHelper,
};
