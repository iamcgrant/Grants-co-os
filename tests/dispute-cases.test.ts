import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";

const testDb = path.join(process.cwd(), "prisma", "test-dispute-cases.db");

describe("in-OS dispute cases", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  let createCase: typeof import("../src/lib/disputes/cases").createCase;
  let addCaseItem: typeof import("../src/lib/disputes/cases").addCaseItem;
  let setChecklistItem: typeof import("../src/lib/disputes/cases").setChecklistItem;
  let advanceCase: typeof import("../src/lib/disputes/cases").advanceCase;
  let updatePacketNotes: typeof import("../src/lib/disputes/cases").updatePacketNotes;
  let getOpenCaseForClient: typeof import("../src/lib/disputes/cases").getOpenCaseForClient;
  let listDisputeFoxBoard: typeof import("../src/lib/disputes/cases").listDisputeFoxBoard;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.AUTH_SECRET = "test-secret-for-vitest-only-32chars!!";
    resetSqliteFromSchema(testDb);
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    vi.resetModules();
    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
    const cases = await import("../src/lib/disputes/cases");
    createCase = cases.createCase;
    addCaseItem = cases.addCaseItem;
    setChecklistItem = cases.setChecklistItem;
    advanceCase = cases.advanceCase;
    updatePacketNotes = cases.updatePacketNotes;
    getOpenCaseForClient = cases.getOpenCaseForClient;
    listDisputeFoxBoard = cases.listDisputeFoxBoard;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  async function seedClient() {
    return prisma.client.create({
      data: {
        grantsClientId: `GC-${Math.random().toString().slice(2, 8)}`,
        email: `case-${Date.now()}@example.com`,
        emailNormalized: `case-${Date.now()}@example.com`,
        firstName: "Pat",
        lastName: "Client",
      },
    });
  }

  it("does not treat official portals as the product UI", () => {
    const workspace = fs.readFileSync(
      path.join(process.cwd(), "src/components/disputes/CaseWorkspace.tsx"),
      "utf8",
    );
    expect(workspace).toMatch(/Packet/);
    expect(workspace).toMatch(/Checklist/);
    expect(workspace).toMatch(/Result tracking/);
    expect(workspace).toMatch(/next === "SUBMITTED"/);
    expect(workspace).not.toMatch(/Open portal/);
  });

  it("opens an Experian case with packet, checklist, items, and result dates", async () => {
    const client = await seedClient();
    const opened = await createCase({ clientId: client.id, channel: "EXPERIAN" });
    expect(opened.status).toBe("INTAKE");
    expect(opened.checklist.length).toBeGreaterThan(2);

    await addCaseItem({ caseId: opened.id, label: "Cap One card", bureau: "EXPERIAN", reason: "not mine" });
    await updatePacketNotes({ caseId: opened.id, packetNotes: "ID + auth + report page" });
    let current = await advanceCase({ caseId: opened.id });
    expect(current.status).toBe("PACKET");

    for (const row of current.checklist.filter((c) => c.required)) {
      current = await setChecklistItem({ caseId: opened.id, key: row.key, done: true });
    }
    current = await advanceCase({ caseId: opened.id });
    expect(current.status).toBe("READY");
    current = await advanceCase({ caseId: opened.id, externalRef: "EXP-1" });
    expect(current.status).toBe("SUBMITTED");
    expect(current.submittedAt).toBeTruthy();
    current = await advanceCase({ caseId: opened.id, outcome: "Updated" });
    expect(current.status).toBe("RESULTS");
    expect(current.resultsAt).toBeTruthy();
  });

  it("refuses Ready before required checklist is done", async () => {
    const client = await seedClient();
    const opened = await createCase({ clientId: client.id, channel: "CFPB" });
    await addCaseItem({ caseId: opened.id, label: "Furnisher no response" });
    await advanceCase({ caseId: opened.id });
    await expect(advanceCase({ caseId: opened.id })).rejects.toThrow(/checklist/i);
  });

  it("reuses an open DisputeFox case for the same client", async () => {
    const client = await seedClient();
    const first = await createCase({ clientId: client.id, channel: "DISPUTEFOX" });
    const second = await createCase({ clientId: client.id, channel: "DISPUTEFOX" });
    expect(second.id).toBe(first.id);
    const open = await getOpenCaseForClient(client.id, "DISPUTEFOX");
    expect(open?.id).toBe(first.id);
  });

  it("opens a SmartCredit case with packet, checklist, and results", async () => {
    const client = await seedClient();
    const opened = await createCase({ clientId: client.id, channel: "SMARTCREDIT" });
    expect(opened.status).toBe("INTAKE");
    expect(opened.checklist.some((row) => row.key === "attached")).toBe(true);

    await addCaseItem({ caseId: opened.id, label: "Experian score freeze", bureau: "EXPERIAN" });
    await updatePacketNotes({ caseId: opened.id, packetNotes: "Member attached · session notes" });
    let current = await advanceCase({ caseId: opened.id });
    expect(current.status).toBe("PACKET");

    for (const row of current.checklist.filter((c) => c.required)) {
      current = await setChecklistItem({ caseId: opened.id, key: row.key, done: true });
    }
    current = await advanceCase({ caseId: opened.id });
    expect(current.status).toBe("READY");
    current = await advanceCase({ caseId: opened.id, externalRef: "SC-SESS-1" });
    expect(current.status).toBe("SUBMITTED");
    current = await advanceCase({ caseId: opened.id, outcome: "Scores recorded" });
    expect(current.status).toBe("RESULTS");
    expect(current.resultsAt).toBeTruthy();
  });

  it("lists DisputeFox board from OS-attached clients, not a live DF list", async () => {
    const client = await seedClient();
    await prisma.clientIdentifier.create({
      data: { clientId: client.id, provider: "DISPUTEFOX", externalId: "df_os_only" },
    });
    const board = await listDisputeFoxBoard();
    expect(board.some((row) => row.grantsClientId === client.grantsClientId && row.disputeFoxId === "df_os_only")).toBe(
      true,
    );
  });
});
