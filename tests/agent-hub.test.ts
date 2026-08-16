import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";

const testDb = path.join(process.cwd(), "prisma", "test-agent-hub.db");

describe("Grants Agent Hub — bidirectional bridge", () => {
  let routeAndAsk: typeof import("../src/lib/agent-hub").routeAndAsk;
  let createCodeChangeAndLaunch: typeof import("../src/lib/agent-hub").createCodeChangeAndLaunch;
  let reportCursorResult: typeof import("../src/lib/agent-hub").reportCursorResult;
  let getTask: typeof import("../src/lib/agent-hub").getTask;
  let getGhlSchema: typeof import("../src/lib/agent-hub").getGhlSchema;
  let getAgentCapabilities: typeof import("../src/lib/agent-hub").getAgentCapabilities;
  let prisma: import("../src/generated/prisma/client").PrismaClient;

  beforeAll(async () => {
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.GC_ENV = "development";
    delete process.env.CURSOR_API_KEY;
    delete process.env.AGENT_HUB_SIMULATE_CURSOR;
    execSync("npx prisma db push", {
      env: { ...process.env, DATABASE_URL: `file:${testDb}` },
      stdio: "pipe",
    });
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
    const hub = await import("../src/lib/agent-hub");
    routeAndAsk = hub.routeAndAsk;
    createCodeChangeAndLaunch = hub.createCodeChangeAndLaunch;
    reportCursorResult = hub.reportCursorResult;
    getTask = hub.getTask;
    getGhlSchema = hub.getGhlSchema;
    getAgentCapabilities = hub.getAgentCapabilities;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it("Cursor → X1 answers GHL DisputeFox field mapping without Charles", async () => {
    const result = await routeAndAsk({
      question: "Which GHL field is the DisputeFox Client ID?",
      preferredAgentId: "x1-operations",
      fromRole: "CURSOR",
    });
    expect(result.escalated).toBe(false);
    if (result.escalated) return;
    expect(result.agentId).toBe("x1-operations");
    const payload = result.result as { answer?: string; mapping?: { fieldKey?: string } };
    expect(payload.answer || "").toMatch(/disputefox_client_id/i);
    expect(JSON.stringify(result)).not.toMatch(/sk_live_|Bearer [A-Za-z0-9]{20,}/i);

    const task = await getTask(result.taskId as string);
    expect(task?.status).toBe("COMPLETED");
    expect(task?.messages.length).toBeGreaterThanOrEqual(2);
  });

  it("exposes GHL schema mappings as durable facts", async () => {
    const schema = await getGhlSchema("weekly");
    expect(schema.fields.length).toBeGreaterThan(0);
    const caps = await getAgentCapabilities("x1-operations");
    expect(caps.found).toBe(true);
    expect((caps as { mode?: string }).mode).toBe("GRANTS_NATIVE_AGENT");
  });

  it("X1 → CODE_CHANGE_REQUIRED → Cursor bridge queues without owner relay", async () => {
    const { task, launch } = await createCodeChangeAndLaunch({
      title: "Add Intake Status mapping to Client 360",
      prompt: "Add Intake Status mapping to Client 360 using ghl.field.intake_status.",
      ownerAgentId: "x1-operations",
      idempotencyKey: `test:intake-status-${Date.now()}`,
    });
    expect(task.type).toBe("CODE_CHANGE_REQUIRED");
    expect(launch.mode).toBe("QUEUED_AWAITING_KEY");
    expect(launch.message).toMatch(/CURSOR_API_KEY/i);

    const stored = await getTask(task.id);
    expect(stored?.status).toBe("AWAITING_CURSOR_API_KEY");

    // Prove reverse completion path (Cursor → Hub callback)
    await reportCursorResult({
      taskId: task.id,
      status: "COMPLETED",
      summary: "Added Intake Status to Client 360 identity panel (dev).",
      branch: "cursor/intake-status-test",
    });
    const done = await getTask(task.id);
    expect(done?.status).toBe("COMPLETED");
    expect(done?.resultJson || "").toMatch(/Intake Status/i);
  });

  it("routes payment questions to payment-processing agent", async () => {
    const result = await routeAndAsk({
      question: "Has this payment settled for architecture overview?",
      fromRole: "CURSOR",
    });
    if (result.escalated) throw new Error("unexpected escalation");
    expect(result.agentId).toBe("payment-processing");
  });

  it("never returns secret-like keys in health payload", async () => {
    const { getSystemHealth } = await import("../src/lib/agent-hub");
    const health = await getSystemHealth();
    expect(JSON.stringify(health)).not.toMatch(/GHL_LOGIN_PASSWORD|sk_live|Bearer [A-Za-z0-9]/);
  });
});
