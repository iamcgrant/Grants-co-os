export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startCursorReturnPoller } = await import("./lib/agent-hub/cursor-poller");
  startCursorReturnPoller();
}
