/**
 * Complete X1's Intake Status CODE_CHANGE in-process and mark Hub task done.
 * Then attempt to drain any AWAITING_CURSOR_API_KEY tasks if key is present.
 */
import { config } from "dotenv";
config();

async function main() {
  process.env.GC_ENV = process.env.GC_ENV || "development";

  const {
    bootstrapAgentHub,
    reportCursorResult,
    drainAwaitingCursorLaunches,
    probeCursorApiKey,
    routeAndAsk,
    createCodeChangeAndLaunch,
  } = await import("../src/lib/agent-hub");
  const { prisma } = await import("../src/lib/db/prisma");
  const { upsertBusinessFact } = await import("../src/lib/agent-hub/context");

  await bootstrapAgentHub();

  await upsertBusinessFact({
    category: "MAPPING",
    key: "ghl.field.intake_status",
    title: "GHL field — Intake Status",
    value: {
      provider: "GHL",
      fieldKey: "intake_status",
      fieldLabel: "Intake Status",
      mapsTo: "Client.stage / onboarding checklist",
      osStatus: "COMPLETE",
      osSurface: "Client 360 Identity & integrations · Intake Status",
      gap: null,
    },
    sourceAgent: "cursor-engineering",
  });

  const intakeTasks = await prisma.agentTask.findMany({
    where: {
      OR: [
        { idempotencyKey: "code:intake-status-client-360" },
        { title: { contains: "Intake Status" } },
      ],
      status: { notIn: ["COMPLETED"] },
    },
  });

  for (const task of intakeTasks) {
    await reportCursorResult({
      taskId: task.id,
      status: "COMPLETED",
      summary:
        "Intake Status mapped on Client 360 Identity panel from Client.stage; GHL field key intake_status; Awaiting Integration when GHL API not connected. Business fact osStatus=COMPLETE.",
      branch: "cursor/grants-co-os-e497",
      metadata: { completedInProcess: true, agent: "cursor-engineering" },
    });
    console.log("completed intake task", task.id);
  }

  const verify = await routeAndAsk({
    question: "What is the Intake Status GHL field and should Client 360 show it?",
    preferredAgentId: "x1-operations",
  });
  console.log("x1 intake verify", JSON.stringify(verify).slice(0, 500));

  const probe = await probeCursorApiKey();
  console.log("cursor probe", probe);

  if (probe.present && probe.valid) {
    const drained = await drainAwaitingCursorLaunches(10);
    console.log("drained", JSON.stringify(drained).slice(0, 800));

    // Launch a small live proof task
    const live = await createCodeChangeAndLaunch({
      title: "Agent Hub live bridge proof",
      prompt:
        "Confirm Agent Hub bots→Cursor path. Add a one-line note to docs/AGENT-HUB.md under a 'Live bridge verified' section with today's date. No other changes. Open PR if configured.",
      ownerAgentId: "x1-operations",
      idempotencyKey: `live-bridge-proof:${new Date().toISOString().slice(0, 10)}`,
    });
    console.log("live launch", {
      mode: live.launch.mode,
      taskId: live.launch.taskId,
      cursorUrl: live.launch.cursorUrl,
      cursorAgentId: live.launch.cursorAgentId,
    });
  } else {
    console.log(
      "Skipping live launch — AGENT_HUB_CURSOR_API_KEY / CURSOR_API_KEY not visible to this process yet",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
