import { getProductionDatabaseRefusal } from "./lib/db/production-guard";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (getProductionDatabaseRefusal()) return;

  if (process.env.OWNER_BOOTSTRAP_PASSWORD) {
    const { ensureOwnerPasswordFromEnv } = await import("./lib/auth/owner-bootstrap");
    await ensureOwnerPasswordFromEnv().catch(() => undefined);
  }

  const { startCursorReturnPoller } = await import("./lib/agent-hub/cursor-poller");
  startCursorReturnPoller();

  // Background workers — run on production Node runtime (not edge).
  const { drainAutomationQueue, scheduleFridayCreditPulse } = await import(
    "./lib/automations/engine"
  );

  const AUTOMATION_MS = 30_000;
  const FRIDAY_CHECK_MS = 60 * 60 * 1000;

  if (!(globalThis as { __gcAutomationTimer?: NodeJS.Timeout }).__gcAutomationTimer) {
    (globalThis as { __gcAutomationTimer?: NodeJS.Timeout }).__gcAutomationTimer = setInterval(() => {
      void drainAutomationQueue(25).catch(() => undefined);
    }, AUTOMATION_MS);
  }

  if (!(globalThis as { __gcFridayTimer?: NodeJS.Timeout }).__gcFridayTimer) {
    (globalThis as { __gcFridayTimer?: NodeJS.Timeout }).__gcFridayTimer = setInterval(() => {
      const now = new Date();
      // Friday 14:00–15:00 UTC window — schedule once per day key
      if (now.getUTCDay() === 5 && now.getUTCHours() === 14) {
        void scheduleFridayCreditPulse()
          .then(() => drainAutomationQueue(50))
          .catch(() => undefined);
      }
    }, FRIDAY_CHECK_MS);
  }
}
