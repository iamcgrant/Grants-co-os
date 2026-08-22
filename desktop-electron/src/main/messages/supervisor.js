"use strict";

const { isUserSendOp, isAutonomousOp } = require("./ops");
const { safeLog } = require("./log");

const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const POLL_MS = 2500;
const PERMISSION_MS = 4000;

function nextBackoff(current, { min = MIN_BACKOFF_MS, max = MAX_BACKOFF_MS } = {}) {
  if (!current) return min;
  return Math.min(current * 2, max);
}

function createSupervisor({
  helper,
  readPermissionStatus,
  isEntitled,
  isKilled,
  onEvent,
  timers = {},
} = {}) {
  const setTimeoutFn = timers.setTimeout || setTimeout;
  const clearTimeoutFn = timers.clearTimeout || clearTimeout;
  const setIntervalFn = timers.setInterval || setInterval;
  const clearIntervalFn = timers.clearInterval || clearInterval;

  let backoffMs = 0;
  let restartTimer = null;
  let pollTimer = null;
  let permissionTimer = null;
  let running = false;
  let lastReady = false;
  let conversationId = null;
  let conversations = [];
  let unsubscribeCrash = null;

  function emit(kind, payload) {
    onEvent?.({ kind, payload });
  }

  async function autonomousRun(op, payload) {
    if (isUserSendOp(op)) {
      safeLog("info", "autonomous-send-blocked", { op });
      return { ok: false, reason: "autonomous-send-forbidden" };
    }
    if (!isAutonomousOp(op) && op !== "active-account") {
      return { ok: false, reason: "not-autonomous" };
    }
    return helper.run(op, payload || {});
  }

  function canRun() {
    if (isKilled?.()) return false;
    if (!isEntitled?.()) return false;
    const status = readPermissionStatus();
    return Boolean(status?.ready);
  }

  function stopTimers() {
    if (restartTimer) clearTimeoutFn(restartTimer);
    if (pollTimer) clearIntervalFn(pollTimer);
    if (permissionTimer) clearIntervalFn(permissionTimer);
    restartTimer = null;
    pollTimer = null;
    permissionTimer = null;
  }

  function stop() {
    running = false;
    stopTimers();
    helper.stop?.();
  }

  async function syncConversations() {
    const result = await autonomousRun("list-conversations", {});
    if (result.ok) {
      conversations = result.data;
      emit("conversations", result.data);
    }
    return result;
  }

  async function syncOpenThread() {
    if (!conversationId) return { ok: true };
    const result = await autonomousRun("load-messages", { conversationId });
    if (result.ok) emit("messages", result.data);
    return result;
  }

  async function tick() {
    if (!canRun()) {
      const status = readPermissionStatus();
      if (lastReady && !status.ready) {
        lastReady = false;
        helper.stop?.();
        emit("permissions-revoked", status);
      }
      return;
    }
    await syncConversations();
    await syncOpenThread();
  }

  function startPolling() {
    if (pollTimer) clearIntervalFn(pollTimer);
    pollTimer = setIntervalFn(() => {
      tick().catch(() => {});
    }, POLL_MS);
  }

  function startPermissionWatch() {
    if (permissionTimer) clearIntervalFn(permissionTimer);
    permissionTimer = setIntervalFn(() => {
      const status = readPermissionStatus();
      if (lastReady && !status.ready) {
        lastReady = false;
        helper.stop?.();
        emit("permissions-revoked", status);
        return;
      }
      if (!lastReady && status.ready && isEntitled?.() && !isKilled?.()) {
        start().catch(() => {});
      }
    }, PERMISSION_MS);
  }

  function scheduleRestart() {
    if (isKilled?.() || !isEntitled?.()) return;
    if (restartTimer) return;
    backoffMs = nextBackoff(backoffMs);
    safeLog("info", "helper-backoff", { backoffMs });
    restartTimer = setTimeoutFn(() => {
      restartTimer = null;
      start().catch(() => {});
    }, backoffMs);
  }

  async function start() {
    if (isKilled?.() || !isEntitled?.()) {
      stop();
      return { ok: false, reason: "not-entitled" };
    }
    const status = readPermissionStatus();
    if (!status.ready) {
      lastReady = false;
      emit("permissions", status);
      startPermissionWatch();
      return { ok: false, reason: status.reason || "needs-permissions" };
    }

    running = true;
    lastReady = true;
    backoffMs = 0;
    if (!unsubscribeCrash && helper.onCrash) {
      unsubscribeCrash = helper.onCrash(() => {
        if (running) scheduleRestart();
      });
    }
    helper.startWatch?.((event) => {
      if (event?.kind === "watch") emit("realtime", event.payload);
    });
    startPolling();
    startPermissionWatch();
    await tick();
    emit("ready", { conversationId });
    return { ok: true };
  }

  async function reconnect(reason = "reconnect") {
    safeLog("info", "helper-reconnect", { reason });
    backoffMs = 0;
    helper.stop?.();
    return start();
  }

  function focusConversation(id) {
    conversationId = id || null;
    if (id && running) {
      syncOpenThread().catch(() => {});
    }
  }

  function snapshot() {
    return {
      running,
      lastReady,
      conversationId,
      conversations,
      backoffMs,
    };
  }

  return {
    start,
    stop,
    reconnect,
    focusConversation,
    autonomousRun,
    snapshot,
    canRun,
  };
}

module.exports = {
  MIN_BACKOFF_MS,
  MAX_BACKOFF_MS,
  POLL_MS,
  nextBackoff,
  createSupervisor,
};
