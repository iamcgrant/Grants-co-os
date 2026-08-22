import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";

const testDb = path.join(process.cwd(), "prisma", "test-smartcredit-workspace.db");

const ENV_KEYS = [
  "SMARTCREDIT_SPONSOR_URL",
  "SMARTCREDIT_SPONSOR_CODE",
  "SMARTCREDIT_API_KEY",
  "SMARTCREDIT_API_PROBE_URL",
] as const;

describe("native SmartCredit workspace", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  let attachSmartCreditClient: typeof import("../src/lib/credit/smartcredit-workspace").attachSmartCreditClient;
  let recordSmartCreditSession: typeof import("../src/lib/credit/smartcredit-workspace").recordSmartCreditSession;
  let startSmartCreditEnrollment: typeof import("../src/lib/credit/smartcredit-workspace").startSmartCreditEnrollment;
  let listSmartCreditBoard: typeof import("../src/lib/credit/smartcredit-workspace").listSmartCreditBoard;
  let latestSmartCreditRecordedAt: typeof import("../src/lib/credit/smartcredit-workspace").latestSmartCreditRecordedAt;
  let probeSmartCreditHealth: typeof import("../src/lib/credit/smartcredit-health").probeSmartCreditHealth;
  const prevEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeAll(async () => {
    for (const key of ENV_KEYS) {
      prevEnv[key] = process.env[key];
      delete process.env[key];
    }
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.AUTH_SECRET = "test-secret-for-vitest-only-32chars!!";
    resetSqliteFromSchema(testDb);
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    vi.resetModules();
    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
    const workspace = await import("../src/lib/credit/smartcredit-workspace");
    attachSmartCreditClient = workspace.attachSmartCreditClient;
    recordSmartCreditSession = workspace.recordSmartCreditSession;
    startSmartCreditEnrollment = workspace.startSmartCreditEnrollment;
    listSmartCreditBoard = workspace.listSmartCreditBoard;
    latestSmartCreditRecordedAt = workspace.latestSmartCreditRecordedAt;
    const health = await import("../src/lib/credit/smartcredit-health");
    probeSmartCreditHealth = health.probeSmartCreditHealth;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    for (const key of ENV_KEYS) {
      if (prevEnv[key] === undefined) delete process.env[key];
      else process.env[key] = prevEnv[key];
    }
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  async function wipeRecordedOps() {
    await prisma.integrationSyncEvent.deleteMany({
      where: { entityType: { in: ["SMARTCREDIT_SESSION", "SMARTCREDIT_ENROLLMENT"] } },
    });
    await prisma.creditConnection.updateMany({
      where: { provider: "SMARTCREDIT" },
      data: { lastSyncedAt: null },
    });
    await prisma.disputeCase.updateMany({
      where: { channel: "SMARTCREDIT" },
      data: { submittedAt: null, resultsAt: null },
    });
  }

  async function seedClient(suffix = Math.random().toString().slice(2, 8)) {
    return prisma.client.create({
      data: {
        grantsClientId: `GC-SC${suffix}`,
        email: `sc-${suffix}@example.com`,
        emailNormalized: `sc-${suffix}@example.com`,
        firstName: "Sam",
        lastName: "Credit",
      },
    });
  }

  it("does not treat the official portal as the product UI", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/credit/smartcredit/page.tsx"), "utf8");
    expect(page).toMatch(/loadSmartCreditDeskSafe/);
    expect(page).toMatch(/SmartCreditAttachForm/);
    expect(page).toMatch(/SmartCreditSessionForm/);
    expect(page).toMatch(/Access denied/);
    expect(page).not.toMatch(/Open portal|open portal/i);
    expect(page).not.toMatch(/cheerio|puppeteer|playwright/i);
    expect(page).not.toMatch(/https:\/\/www\.smartcredit\.com/);
  });

  it("attaches a staff-recorded SmartCredit id without inventing one", async () => {
    await wipeRecordedOps();
    const client = await seedClient("attach");
    const result = await attachSmartCreditClient({
      clientId: client.grantsClientId,
      externalId: " sc_member_184 ",
    });
    expect(result.identifier.externalId).toBe("sc_member_184");
    expect(result.identifier.clientId).toBe(client.id);
    const board = await listSmartCreditBoard();
    expect(board.some((row) => row.grantsClientId === client.grantsClientId && row.smartCreditId === "sc_member_184")).toBe(
      true,
    );
    expect(await latestSmartCreditRecordedAt()).toBeNull();
  });

  it("refuses to move a SmartCredit id onto a second Grants master", async () => {
    const first = await seedClient("one");
    const second = await seedClient("two");
    await attachSmartCreditClient({ clientId: first.id, externalId: "sc_shared" });
    await expect(attachSmartCreditClient({ clientId: second.id, externalId: "sc_shared" })).rejects.toThrow(
      /already attached/i,
    );
  });

  it("records a session and marks health CONNECTED only after that operation", async () => {
    await wipeRecordedOps();
    process.env.SMARTCREDIT_SPONSOR_URL = "https://www.smartcredit.com/join/?pid=69411";
    const before = await probeSmartCreditHealth();
    expect(before.status).toBe("DEGRADED");
    expect(before.lastSuccessAt).toBeNull();
    expect(before.detail).toMatch(/no live score sync/);

    const client = await seedClient("sess");
    const session = await recordSmartCreditSession({
      clientId: client.id,
      kind: "SCORE_REVIEW",
      notes: "Client read VantageScore 3.0 in SmartCredit",
      result: "EQ 640 / EX 651 / TU 638",
    });
    expect(session.lastStepUrl).toBeNull();
    expect(session.recordedAt).toBeTruthy();

    const after = await probeSmartCreditHealth();
    expect(after.status).toBe("CONNECTED");
    expect(after.lastSuccessAt).toBeTruthy();
    expect(after.detail).toMatch(/Recorded SmartCredit workspace operation/);
  });

  it("never marks CONNECTED because an API key is present", async () => {
    await wipeRecordedOps();
    process.env.SMARTCREDIT_API_KEY = "sc_test_not_a_real_key";
    const health = await probeSmartCreditHealth();
    expect(health.status).toBe("DEGRADED");
    expect(health.status).not.toBe("CONNECTED");
    expect(health.lastSuccessAt).toBeNull();
    expect(health.detail).toMatch(/Key presence is never CONNECTED/);
  });

  it("CONNECTS only after a successful https probe when no recorded op exists", async () => {
    await wipeRecordedOps();
    process.env.SMARTCREDIT_API_KEY = "sc_test_not_a_real_key";
    process.env.SMARTCREDIT_API_PROBE_URL = "https://api.smartcredit.example/health";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const health = await probeSmartCreditHealth();
    expect(health.status).toBe("CONNECTED");
    expect(health.probed).toBe(true);
    expect(health.lastSuccessAt).toBeTruthy();
  });

  it("records enrollment last-step without inventing a member id", async () => {
    process.env.SMARTCREDIT_SPONSOR_URL = "https://www.smartcredit.com/join/?pid=69411";
    const client = await seedClient("enroll");
    const enrollment = await startSmartCreditEnrollment({ clientId: client.id });
    expect(enrollment.enrollmentUrl).toContain("pid=69411");
    expect(enrollment.enrollmentUrl).toContain(`gc_ref=${client.grantsClientId}`);
    expect(enrollment.sponsorConfigured).toBe(true);
    const ident = await prisma.clientIdentifier.findFirst({
      where: { clientId: client.id, provider: "SMARTCREDIT" },
    });
    expect(ident).toBeNull();
  });
});
