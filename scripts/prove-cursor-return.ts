/**
 * Prove Cursor → Agent Hub return path against the live finished agent.
 * Never prints secrets.
 *
 * Hub task: cmsw2whyf000gnpjsdjg6al0m
 * Cursor agent: bc-f5d398c9-5cb7-45e3-99ea-6dd1ead13bcd
 * Expected PR: https://github.com/iamcgrant/Grants-co-os/pull/4
 */
import { config } from "dotenv";
config();
process.env.GC_ENV = process.env.GC_ENV || "development";
process.env.AGENT_HUB_DISABLE_CURSOR_POLLER = "true";

const TASK_ID = "cmsw2whyf000gnpjsdjg6al0m";
const CURSOR_AGENT_ID = "bc-f5d398c9-5cb7-45e3-99ea-6dd1ead13bcd";
const CURSOR_RUN_ID = "run-04ba96bf-63c3-4a8b-99ec-75acbe1edcc6";
const EXPECTED_PR = "https://github.com/iamcgrant/Grants-co-os/pull/4";

async function main() {
  const {
    bootstrapAgentHub,
    probeCursorApiKey,
    ingestCursorAgentReturn,
    getTask,
  } = await import("../src/lib/agent-hub");
  const { prisma } = await import("../src/lib/db/prisma");

  await bootstrapAgentHub();
  const probe = await probeCursorApiKey();
  if (!probe.present || !probe.valid) {
    console.log(
      JSON.stringify({
        ok: false,
        reason: "cursor_api_not_ready",
        present: probe.present,
        valid: probe.valid,
        sourceName: "sourceName" in probe ? probe.sourceName : null,
      }),
    );
    process.exit(2);
  }

  const before = await prisma.agentTask.findUnique({
    where: { id: TASK_ID },
    select: { id: true, status: true, cursorAgentId: true, resultJson: true },
  });

  const ingested = await ingestCursorAgentReturn({
    cursorAgentId: CURSOR_AGENT_ID,
    taskId: TASK_ID,
    cursorRunId: CURSOR_RUN_ID,
    title: "Agent Hub live bridge proof",
    idempotencyKey: "live-bridge-proof:2026-08-16",
    forceWaiting: true,
    prompt:
      "Confirm Agent Hub bots→Cursor path. Add a one-line note to docs/AGENT-HUB.md under a Live bridge verified section.",
  });

  const after = await getTask(TASK_ID);
  const result = after?.resultJson ? (JSON.parse(after.resultJson) as Record<string, unknown>) : null;
  const prUrl = typeof result?.prUrl === "string" ? result.prUrl : null;

  const proof = {
    ok: after?.status === "COMPLETED" && prUrl === EXPECTED_PR,
    endpoint: "GET https://api.cursor.com/v1/agents/:id + GET /v1/agents/:id/runs/:runId → ingestCursorAgentReturn",
    hubTaskId: TASK_ID,
    cursorAgentId: CURSOR_AGENT_ID,
    cursorRunId: CURSOR_RUN_ID,
    beforeStatus: before?.status || "MISSING",
    afterStatus: after?.status || null,
    prUrl,
    branch: result?.branch || null,
    summary: typeof result?.summary === "string" ? result.summary.slice(0, 240) : null,
    syncOutcome: ingested && "sync" in ingested ? ingested.sync : null,
    cursorKeySource: probe.sourceName,
  };

  console.log(JSON.stringify(proof, null, 2));
  await prisma.$disconnect();
  if (!proof.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
