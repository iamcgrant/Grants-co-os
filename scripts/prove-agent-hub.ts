/**
 * Prove Agent Hub first slice: Cursor→X1 and X1→Cursor queue.
 * Run: npx tsx scripts/prove-agent-hub.ts
 */
import { config } from "dotenv";
config();
process.env.GC_ENV = process.env.GC_ENV || "development";

async function main() {
  const {
    bootstrapAgentHub,
    routeAndAsk,
    createCodeChangeAndLaunch,
    reportCursorResult,
    getControlCenterSnapshot,
  } = await import("../src/lib/agent-hub");

  await bootstrapAgentHub();

  console.log("=== 1) Cursor → X1 (GHL DisputeFox field) ===");
  const ask = await routeAndAsk({
    question: "Which GHL field is the DisputeFox Client ID?",
    preferredAgentId: "x1-operations",
    fromRole: "CURSOR",
  });
  console.log(JSON.stringify(ask, null, 2));

  console.log("\n=== 2) X1 gap → CODE_CHANGE_REQUIRED → Cursor bridge ===");
  const intake = await routeAndAsk({
    question: "What is the Intake Status GHL field and should Client 360 show it?",
    preferredAgentId: "x1-operations",
    fromRole: "CURSOR",
  });
  console.log(JSON.stringify(intake, null, 2));

  console.log("\n=== 3) Explicit code change launch ===");
  const launch = await createCodeChangeAndLaunch({
    title: "Prove Agent Hub Cursor bridge",
    prompt: "No-op documentation note for Agent Hub bridge proof. Dev scope only.",
    ownerAgentId: "x1-operations",
    idempotencyKey: `prove:bridge:${Date.now()}`,
  });
  console.log(JSON.stringify(launch.launch, null, 2));

  if (launch.task.id) {
    await reportCursorResult({
      taskId: launch.task.id,
      status: "COMPLETED",
      summary: "Bridge proof: Cursor result returned to Agent Hub.",
    });
  }

  const snap = await getControlCenterSnapshot();
  console.log("\n=== Control Center agents ===");
  console.log(
    snap.agents.map((a) => `${a.displayName}: ${a.status} (${a.mode})`).join("\n"),
  );
  console.log(`Active tasks: ${snap.activeTasks.length}; Approvals: ${snap.approvals.length}`);
  console.log(`Cursor bridge: ${snap.bridges.cursorLaunch}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
