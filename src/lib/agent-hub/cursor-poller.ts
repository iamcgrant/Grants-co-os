/**
 * Background Cursor → Hub return poller.
 * v1 Cloud Agents API has no webhooks; poll GET /v1/agents/:id/runs/:runId.
 */

import { isCursorLaunchReady, syncWaitingCursorTasks } from "./cursor-bridge";

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;

function pollerEnabled() {
  if (process.env.AGENT_HUB_DISABLE_CURSOR_POLLER === "true") return false;
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") return false;
  return true;
}

export function startCursorReturnPoller() {
  if (started || !pollerEnabled()) return { started: false, reason: "disabled-or-already-running" };
  started = true;

  const intervalMs = Math.max(10_000, Number(process.env.AGENT_HUB_CURSOR_POLL_MS || 30_000) || 30_000);

  const tick = async () => {
    if (!isCursorLaunchReady()) return;
    try {
      await syncWaitingCursorTasks();
    } catch {
      // Never interrupt the OS process; next tick retries.
    }
  };

  void tick();
  timer = setInterval(() => {
    void tick();
  }, intervalMs);
  timer.unref?.();

  return { started: true, intervalMs };
}

export function stopCursorReturnPoller() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}
