import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";

const testDb = path.join(process.cwd(), "prisma", "test-tax-workspaces.db");

describe("native Cloud Tax Office + SBTPG desks", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  let attachTaxDeskClient: typeof import("../src/lib/tax/desk").attachTaxDeskClient;
  let recordTaxDeskSession: typeof import("../src/lib/tax/desk").recordTaxDeskSession;
  let listTaxDeskBoard: typeof import("../src/lib/tax/desk").listTaxDeskBoard;
  let latestTaxDeskRecordedAt: typeof import("../src/lib/tax/desk").latestTaxDeskRecordedAt;
  let probeTaxDeskHealth: typeof import("../src/lib/tax/health").probeTaxDeskHealth;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.AUTH_SECRET = "test-secret-for-vitest-only-32chars!!";
    resetSqliteFromSchema(testDb);
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    vi.resetModules();
    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
    const desk = await import("../src/lib/tax/desk");
    attachTaxDeskClient = desk.attachTaxDeskClient;
    recordTaxDeskSession = desk.recordTaxDeskSession;
    listTaxDeskBoard = desk.listTaxDeskBoard;
    latestTaxDeskRecordedAt = desk.latestTaxDeskRecordedAt;
    const health = await import("../src/lib/tax/health");
    probeTaxDeskHealth = health.probeTaxDeskHealth;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  async function seedClient(suffix = Math.random().toString().slice(2, 8)) {
    return prisma.client.create({
      data: {
        grantsClientId: `GC-TX${suffix}`,
        email: `tax-${suffix}@example.com`,
        emailNormalized: `tax-${suffix}@example.com`,
        firstName: "Tia",
        lastName: "Return",
      },
    });
  }

  it("does not treat official portals as the product UI", () => {
    const files = [
      "src/app/(staff)/tax/cloud-tax-office/page.tsx",
      "src/app/(staff)/tax/sbtpg/page.tsx",
      "src/app/(staff)/tax/cognito/page.tsx",
    ];
    for (const file of files) {
      const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(src, file).toMatch(/Access denied/);
      expect(src, file).not.toMatch(/cheerio|puppeteer|playwright/i);
      expect(src, file).not.toMatch(/Open portal|open portal/i);
      expect(src, file).not.toMatch(/https:\/\/grantandco\.cloudtaxoffice\.com/);
      expect(src, file).not.toMatch(/https:\/\/pro\.sbtpg\.com/);
    }
    const tax = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/tax/cloud-tax-office/page.tsx"), "utf8");
    expect(tax).toMatch(/listTaxDeskBoard/);
    expect(tax).toMatch(/TaxDeskAttachForm/);
    expect(tax).toMatch(/TaxDeskSessionForm/);
    const sbtpg = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/tax/sbtpg/page.tsx"), "utf8");
    expect(sbtpg).toMatch(/listTaxDeskBoard/);
    expect(sbtpg).toMatch(/TaxDeskAttachForm/);
    expect(sbtpg).toMatch(/SbtpgPayoutForm/);
  });

  it("attaches a Cloud Tax Office return without inventing an id", async () => {
    const client = await seedClient("cto");
    const result = await attachTaxDeskClient({
      desk: "CLOUD_TAX_OFFICE",
      clientId: client.grantsClientId,
      externalId: " cto_return_22 ",
      taxYear: "2025",
    });
    expect(result.identifier.externalId).toBe("cto_return_22");
    const board = await listTaxDeskBoard("CLOUD_TAX_OFFICE");
    expect(
      board.some((row) => row.grantsClientId === client.grantsClientId && row.deskId === "cto_return_22"),
    ).toBe(true);
    expect(await latestTaxDeskRecordedAt("CLOUD_TAX_OFFICE")).toBeNull();
  });

  it("records Cloud Tax status/next action and CONNECTED only after that operation", async () => {
    await prisma.integrationSyncEvent.deleteMany({ where: { entityType: "CLOUD_TAX_OFFICE_SESSION" } });
    await prisma.clientTimelineEvent.deleteMany({
      where: { eventType: { in: ["CLOUD_TAX_OFFICE_SESSION", "CLOUD_TAX_OFFICE_ATTACHED"] } },
    });
    const before = await probeTaxDeskHealth("CLOUD_TAX_OFFICE");
    expect(before.status).toBe("ACTION_REQUIRED");
    expect(before.lastSuccessAt).toBeNull();

    const client = await seedClient("sess");
    const session = await recordTaxDeskSession({
      desk: "CLOUD_TAX_OFFICE",
      clientId: client.id,
      kind: "RETURN_STATUS",
      status: "IN_PREP",
      nextAction: "Collect W-2",
      taxYear: "2025",
      notes: "Organizer started in OS",
    });
    expect(session.lastStepUrl).toBeNull();
    expect(session.recordedAt).toBeTruthy();

    const after = await probeTaxDeskHealth("CLOUD_TAX_OFFICE");
    expect(after.status).toBe("CONNECTED");
    expect(after.lastSuccessAt).toBeTruthy();
    const board = await listTaxDeskBoard("CLOUD_TAX_OFFICE");
    const row = board.find((item) => item.grantsClientId === client.grantsClientId);
    expect(row?.status).toBe("IN_PREP");
    expect(row?.deskNextAction).toBe("Collect W-2");
  });

  it("records Cloud Tax login last-step without scraping", async () => {
    const client = await seedClient("login");
    await attachTaxDeskClient({
      desk: "CLOUD_TAX_OFFICE",
      clientId: client.id,
      externalId: "cto_login_1",
    });
    const session = await recordTaxDeskSession({
      desk: "CLOUD_TAX_OFFICE",
      clientId: client.id,
      kind: "LOGIN",
      status: "REVIEW",
      nextAction: "File after review",
    });
    expect(session.lastStepUrl).toBe("https://grantandco.cloudtaxoffice.com/");
    const board = await listTaxDeskBoard("CLOUD_TAX_OFFICE");
    const row = board.find((item) => item.grantsClientId === client.grantsClientId);
    expect(row?.status).toBe("REVIEW");
    expect(row?.deskNextAction).toBe("File after review");
  });

  it("refuses to move a Cloud Tax id onto a second Grants master", async () => {
    const first = await seedClient("one");
    const second = await seedClient("two");
    await attachTaxDeskClient({ desk: "CLOUD_TAX_OFFICE", clientId: first.id, externalId: "cto_shared" });
    await expect(
      attachTaxDeskClient({ desk: "CLOUD_TAX_OFFICE", clientId: second.id, externalId: "cto_shared" }),
    ).rejects.toThrow(/already attached/i);
  });

  it("tracks an SBTPG payout amount and status in OS", async () => {
    const client = await seedClient("sbt");
    await attachTaxDeskClient({ desk: "SBTPG", clientId: client.id, externalId: "sbt_ref_9" });
    const session = await recordTaxDeskSession({
      desk: "SBTPG",
      clientId: client.id,
      kind: "PAYOUT_CHECK",
      status: "FUNDED",
      amountCents: 184000,
      nextAction: "Confirm deposit",
    });
    expect(session.lastStepUrl).toBeNull();
    const board = await listTaxDeskBoard("SBTPG");
    const row = board.find((item) => item.grantsClientId === client.grantsClientId);
    expect(row?.status).toBe("FUNDED");
    expect(row?.amountCents).toBe(184000);
    const health = await probeTaxDeskHealth("SBTPG");
    expect(health.status).toBe("CONNECTED");
  });
});
