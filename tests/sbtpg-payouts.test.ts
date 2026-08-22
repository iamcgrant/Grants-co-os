import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";

const testDb = path.join(process.cwd(), "prisma", "test-sbtpg-payouts.db");

describe("SBTPG collected payouts", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  let recordSbtpgPayout: typeof import("../src/lib/tax/payouts").recordSbtpgPayout;
  let importOfficialSbtpgPayouts: typeof import("../src/lib/tax/payouts").importOfficialSbtpgPayouts;
  let parseOfficialPayoutImport: typeof import("../src/lib/tax/payouts").parseOfficialPayoutImport;
  let getSbtpgCollectedTotals: typeof import("../src/lib/tax/payouts").getSbtpgCollectedTotals;
  let getFinanceDashboard: typeof import("../src/lib/payments/dashboard").getFinanceDashboard;
  let recordTaxDeskSession: typeof import("../src/lib/tax/desk").recordTaxDeskSession;
  let attachTaxDeskClient: typeof import("../src/lib/tax/desk").attachTaxDeskClient;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.AUTH_SECRET = "test-secret-for-vitest-only-32chars!!";
    resetSqliteFromSchema(testDb);
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    vi.resetModules();
    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
    const payouts = await import("../src/lib/tax/payouts");
    recordSbtpgPayout = payouts.recordSbtpgPayout;
    importOfficialSbtpgPayouts = payouts.importOfficialSbtpgPayouts;
    parseOfficialPayoutImport = payouts.parseOfficialPayoutImport;
    getSbtpgCollectedTotals = payouts.getSbtpgCollectedTotals;
    const finance = await import("../src/lib/payments/dashboard");
    getFinanceDashboard = finance.getFinanceDashboard;
    const desk = await import("../src/lib/tax/desk");
    recordTaxDeskSession = desk.recordTaxDeskSession;
    attachTaxDeskClient = desk.attachTaxDeskClient;
  });

  beforeEach(async () => {
    await prisma.sbtpgPayout.deleteMany();
    await prisma.clientTimelineEvent.deleteMany();
    await prisma.clientIdentifier.deleteMany();
    await prisma.client.deleteMany();
    await prisma.auditLog.deleteMany().catch(() => undefined);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it("does not scrape the SBTPG portal", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/tax/sbtpg/page.tsx"), "utf8");
    const home = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/home/page.tsx"), "utf8");
    expect(page).toMatch(/SbtpgPayoutForm/);
    expect(page).toMatch(/loadSbtpgDesk/);
    expect(page).not.toMatch(/cheerio|puppeteer|playwright/i);
    expect(page).not.toMatch(/https:\/\/pro\.sbtpg\.com/);
    expect(home).not.toMatch(/SbtpgPayoutForm/);
    expect(home).not.toMatch(/SbtpgFeeSummaryIngestForm/);
    expect(home).not.toMatch(/SBTPG/);
    expect(home).not.toMatch(/taxpayer/i);
    expect(home).not.toMatch(/tax program/i);
    expect(home).not.toMatch(/Fee Summary/);
    expect(home).not.toMatch(/\bERO\b/);
    expect(home).toMatch(/totalRevenueCents/);
    expect(home).toMatch(/Total Company Revenue/);
  });

  it("counts PAID/FUNDED official payouts in Command Center collected totals", async () => {
    await recordSbtpgPayout({
      amountCents: 184000,
      status: "PAID",
      paidAt: new Date(),
      notes: "Official August payout",
    });
    await recordSbtpgPayout({
      amountCents: 50000,
      status: "PENDING",
      paidAt: new Date(),
    });
    const totals = await getSbtpgCollectedTotals();
    expect(totals.collectedAllCents).toBe(184000);
    expect(totals.collectedTodayCents).toBe(184000);
    expect(totals.payoutCount).toBe(1);

    const finance = await getFinanceDashboard();
    expect(finance.sbtpgCollectedAllCents).toBe(184000);
    expect(finance.collectedTodayCents).toBeGreaterThanOrEqual(184000);
    expect(finance.collectedWeekCents).toBeGreaterThanOrEqual(184000);
  });

  it("imports official CSV/JSON totals without inventing a scrape", async () => {
    const rows = parseOfficialPayoutImport("990.00,FUNDED,2026-08-20,sbt_official_1,2025,batch");
    expect(rows).toHaveLength(1);
    const imported = await importOfficialSbtpgPayouts({ rows });
    expect(imported.imported).toBe(1);
    const totals = await getSbtpgCollectedTotals();
    expect(totals.collectedAllCents).toBe(99000);
  });

  it("writes an SbtpgPayout when a desk session records an amount", async () => {
    const client = await prisma.client.create({
      data: {
        grantsClientId: "GC-SBT1",
        email: "sbt1@example.com",
        emailNormalized: "sbt1@example.com",
        firstName: "Sam",
        lastName: "Payout",
      },
    });
    await attachTaxDeskClient({ desk: "SBTPG", clientId: client.id, externalId: "sbt_ref_session" });
    await recordTaxDeskSession({
      desk: "SBTPG",
      clientId: client.id,
      kind: "PAYOUT_CHECK",
      status: "FUNDED",
      amountCents: 220000,
    });
    const rows = await prisma.sbtpgPayout.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amountCents).toBe(220000);
    expect(rows[0]?.status).toBe("FUNDED");
  });
});
