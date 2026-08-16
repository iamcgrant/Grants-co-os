/**
 * Recreate the live X1 → Cursor proof task and drain AWAITING_CURSOR_API_KEY.
 * Never prints key values.
 */
import { config } from "dotenv";
config();
process.env.GC_ENV = process.env.GC_ENV || "development";

async function main() {
  const {
    bootstrapAgentHub,
    probeCursorApiKey,
    drainAwaitingCursorLaunches,
    createCodeChangeAndLaunch,
  } = await import("../src/lib/agent-hub");
  const { prisma } = await import("../src/lib/db/prisma");

  await bootstrapAgentHub();
  const probe = await probeCursorApiKey();
  console.log("probe", JSON.stringify(probe));

  const queuedBefore = await prisma.agentTask.findMany({
    where: { status: "AWAITING_CURSOR_API_KEY" },
    select: { id: true, title: true, status: true, idempotencyKey: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(
    "queued_before",
    queuedBefore.length,
    queuedBefore.map((t) => ({ id: t.id, title: t.title, key: t.idempotencyKey })),
  );

  const today = new Date().toISOString().slice(0, 10);
  const live = await createCodeChangeAndLaunch({
    title: "Agent Hub live bridge proof",
    prompt:
      "Confirm Agent Hub bots→Cursor path. Add a one-line note to docs/AGENT-HUB.md under a 'Live bridge verified' section with today's date. No other changes. Open PR if configured.",
    ownerAgentId: "x1-operations",
    idempotencyKey: `live-bridge-proof:${today}`,
  });
  console.log("live_create", {
    mode: live.launch.mode,
    taskId: live.launch.taskId,
    cursorUrl: live.launch.cursorUrl || null,
    cursorAgentId: live.launch.cursorAgentId || null,
    message: live.launch.message,
  });

  const drained = await drainAwaitingCursorLaunches(10);
  console.log(
    "drain",
    JSON.stringify({
      ready: drained.ready,
      count: "count" in drained ? drained.count : 0,
      message: "message" in drained ? drained.message : undefined,
      modes:
        drained.drained?.map((d) => ({
          mode: d.mode,
          taskId: d.taskId,
          cursorUrl: d.cursorUrl || null,
        })) || [],
    }),
  );

  const remaining = await prisma.agentTask.findMany({
    where: {
      status: { in: ["AWAITING_CURSOR_API_KEY", "WAITING_CURSOR", "FAILED", "COMPLETED"] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      idempotencyKey: true,
      cursorAgentId: true,
      cursorUrl: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  console.log(
    "remaining_relevant",
    remaining.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      key: t.idempotencyKey,
      cursorAgentId: t.cursorAgentId,
      cursorUrl: t.cursorUrl,
    })),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
