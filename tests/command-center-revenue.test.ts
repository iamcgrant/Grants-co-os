import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";
import {
  commandCenterRevenueSeries,
  mapCommandCenterRevenue,
  OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22,
  officialSummaryFromFeeSummaryPayouts,
  sbtpgDeskTotals,
} from "../src/lib/tax/fee-summary-mapping";

const testDb = path.join(process.cwd(), "prisma", "test-command-center-revenue.db");

const official = { ...OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22 };

const emptyDated = {
  todayCents: 0,
  weekCents: 0,
  monthCents: 0,
  allCents: 0,
  count: 0,
};

const emptyGrantsPay = {
  todayCents: 0,
  weekCents: 0,
  monthCents: 0,
};

describe("Command Center Total Revenue mapping", () => {
  it("maps official Fee Summary PAID to Total Revenue and keeps UNFUNDED out", () => {
    const revenue = mapCommandCenterRevenue(official, emptyDated, emptyGrantsPay);

    expect(official.paidCents).toBe(11_770_000);
    expect(official.paidTaxpayerCount).toBe(73);
    expect(official.unfundedCents).toBe(2_100_000);
    expect(official.unfundedTaxpayerCount).toBe(12);
    expect(official.fcaCents).toBe(0);
    expect(official.fcaTaxpayerCount).toBe(0);
    expect(official.autoCollectCents).toBe(0);

    expect(revenue.totalRevenueCents).toBe(11_770_000);
    expect(revenue.totalRevenueTaxpayerCount).toBe(73);
    expect(revenue.totalRevenueSource).toBe("SBTPG Fee Summary PAID");
    expect(revenue.totalRevenueWindow).toBe("season-to-date");
    expect(revenue.unfundedCents).toBe(2_100_000);
    expect(revenue.unfundedTaxpayerCount).toBe(12);
    expect(revenue.totalRevenueCents + revenue.unfundedCents).toBe(13_870_000);
    expect(revenue.totalRevenueCents).not.toBe(official.paidCents + official.unfundedCents);
    expect(revenue.fcaCents).toBe(0);
    expect(revenue.autoCollectCents).toBe(0);
    expect(revenue.collectedTodayCents).toBe(0);
    expect(revenue.collectedWeekCents).toBe(0);
    expect(revenue.hasOfficialDailySplit).toBe(false);
    expect(revenue.todayWeekEmpty).toBe(true);
  });

  it("does not invent a today/week split from season-to-date paid", () => {
    const datedLeak = {
      todayCents: 0,
      weekCents: 0,
      monthCents: 0,
      allCents: 11_770_000,
      count: 1,
    };
    const revenue = mapCommandCenterRevenue(official, datedLeak, {
      todayCents: 0,
      weekCents: 0,
      monthCents: 0,
    });
    expect(revenue.totalRevenueCents).toBe(11_770_000);
    expect(revenue.collectedTodayCents).toBe(0);
    expect(revenue.collectedWeekCents).toBe(0);
    expect(revenue.collectedMonthCents).toBe(0);
  });

  it("falls back to dated SbtpgPayout PAID/FUNDED when no official snapshot exists", () => {
    const revenue = mapCommandCenterRevenue(null, {
      todayCents: 184000,
      weekCents: 184000,
      monthCents: 184000,
      allCents: 184000,
      count: 1,
    }, emptyGrantsPay);
    expect(revenue.totalRevenueCents).toBe(184000);
    expect(revenue.totalRevenueSource).toBe("SbtpgPayout PAID/FUNDED");
    expect(revenue.unfundedCents).toBe(0);
    expect(revenue.collectedTodayCents).toBe(184000);
  });

  it("keeps the home Command Center on queried Total Revenue, not a canvas zero", () => {
    const home = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/home/page.tsx"), "utf8");
    expect(home).toMatch(/label="Total Revenue"/);
    expect(home).toMatch(/data\.finance\.totalRevenueCents/);
    expect(home).toMatch(/data\.finance\.unfundedCents/);
    expect(home).toMatch(/COMMAND_CENTER_TOTAL_REVENUE_HREF/);
    expect(home).toMatch(/COMMAND_CENTER_UPDATE_REVENUE_LOGIN_URL/);
    expect(home).toMatch(/COMMAND_CENTER_UPDATE_REVENUE_LABEL/);
    expect(home).toMatch(/OfficialLoginLink/);
    expect(home).toMatch(/OfficialFeeSummaryPersistForm/);
    expect(home).toMatch(/Season-to-date/);
    expect(home).toMatch(/Revenue trend/);
    expect(home).not.toMatch(/117700|117,700/);
    expect(home).not.toMatch(/SBTPG/);
    expect(home).not.toMatch(/taxpayer/i);
    expect(home).not.toMatch(/SbtpgPayoutForm|SbtpgFeeSummaryIngestForm/);
    expect(home).not.toMatch(/<iframe/i);
    expect(home).not.toMatch(/cheerio|puppeteer|playwright/i);
  });

  it("draws the Command Center chart at the official season-to-date total, not an invented series", () => {
    const series = commandCenterRevenueSeries(11_770_000, ["08-16", "08-22"], [0, 75000]);
    expect(series.values).toEqual([11_770_000, 11_770_000]);
    expect(series.values.every((value) => value === 11_770_000)).toBe(true);
  });

  it("maps the native SBTPG desk tiles from the official snapshot, not zeros", () => {
    const desk = sbtpgDeskTotals(official, [], []);
    expect(desk.isLive).toBe(true);
    expect(desk.totalRevenueCents).toBe(11_770_000);
    expect(desk.paidTaxpayerCount).toBe(73);
    expect(desk.unfundedCents).toBe(2_100_000);
    expect(desk.unfundedTaxpayerCount).toBe(12);
    expect(desk.source).toBe("SBTPG Fee Summary PAID");
    expect(desk.window).toBe("season-to-date");
    expect(desk.taxYear).toBe("2026");
    expect(desk.capturedOn).toBe("2026-08-22");
    expect(desk.totalRevenueCents).not.toBe(official.paidCents + official.unfundedCents);
  });

  it("reads FEE_SUMMARY payouts when the snapshot row is missing", () => {
    const fromPayouts = officialSummaryFromFeeSummaryPayouts([
      {
        status: "PAID",
        amountCents: 11_770_000,
        bucket: "FEE_SUMMARY_PAID",
        taxpayerCount: 73,
        taxYear: "2026",
        paidAt: "2026-08-22T12:00:00.000Z",
      },
      {
        status: "UNFUNDED",
        amountCents: 2_100_000,
        bucket: "FEE_SUMMARY_UNFUNDED",
        taxpayerCount: 12,
        taxYear: "2026",
        paidAt: "2026-08-22T12:00:00.000Z",
      },
    ]);
    expect(fromPayouts?.paidCents).toBe(11_770_000);
    expect(fromPayouts?.unfundedCents).toBe(2_100_000);
    const desk = sbtpgDeskTotals(null, [
      {
        status: "PAID",
        amountCents: 11_770_000,
        bucket: "FEE_SUMMARY_PAID",
        taxpayerCount: 73,
        taxYear: "2026",
        paidAt: "2026-08-22T12:00:00.000Z",
      },
      {
        status: "UNFUNDED",
        amountCents: 2_100_000,
        bucket: "FEE_SUMMARY_UNFUNDED",
        taxpayerCount: 12,
        taxYear: "2026",
        paidAt: "2026-08-22T12:00:00.000Z",
      },
    ], []);
    expect(desk.isLive).toBe(true);
    expect(desk.totalRevenueCents).toBe(11_770_000);
    expect(desk.paidTaxpayerCount).toBe(73);
    expect(desk.unfundedCents).toBe(2_100_000);
    expect(desk.unfundedTaxpayerCount).toBe(12);
  });
});

describe("persisted official Fee Summary → Command Center query", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  let persistOfficialSbtpgFeeSummary: typeof import("../src/lib/tax/official-fee-summary").persistOfficialSbtpgFeeSummary;
  let getLatestOfficialFeeSummary: typeof import("../src/lib/tax/official-fee-summary").getLatestOfficialFeeSummary;
  let getSbtpgCollectedTotals: typeof import("../src/lib/tax/payouts").getSbtpgCollectedTotals;
  let getFinanceDashboard: typeof import("../src/lib/payments/dashboard").getFinanceDashboard;
  let recordSbtpgPayout: typeof import("../src/lib/tax/payouts").recordSbtpgPayout;
  let loadSbtpgDesk: typeof import("../src/lib/tax/sbtpg-desk").loadSbtpgDesk;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.AUTH_SECRET = "test-secret-for-vitest-only-32chars!!";
    resetSqliteFromSchema(testDb);
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    vi.resetModules();
    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
    const officialMod = await import("../src/lib/tax/official-fee-summary");
    persistOfficialSbtpgFeeSummary = officialMod.persistOfficialSbtpgFeeSummary;
    getLatestOfficialFeeSummary = officialMod.getLatestOfficialFeeSummary;
    const payouts = await import("../src/lib/tax/payouts");
    getSbtpgCollectedTotals = payouts.getSbtpgCollectedTotals;
    recordSbtpgPayout = payouts.recordSbtpgPayout;
    const finance = await import("../src/lib/payments/dashboard");
    getFinanceDashboard = finance.getFinanceDashboard;
    const desk = await import("../src/lib/tax/sbtpg-desk");
    loadSbtpgDesk = desk.loadSbtpgDesk;
  });

  beforeEach(async () => {
    await prisma.sbtpgPayout.deleteMany();
    await prisma.sbtpgFeeSummarySnapshot.deleteMany();
    await prisma.auditLog.deleteMany().catch(() => undefined);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it("persists Fee Summary PAID as Total Revenue and leaves today/week empty", async () => {
    await persistOfficialSbtpgFeeSummary({ ...OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22 });

    const snapshot = await getLatestOfficialFeeSummary();
    expect(snapshot?.paidCents).toBe(11_770_000);
    expect(snapshot?.paidTaxpayerCount).toBe(73);
    expect(snapshot?.unfundedCents).toBe(2_100_000);
    expect(snapshot?.unfundedTaxpayerCount).toBe(12);
    expect(snapshot?.fcaCents).toBe(0);
    expect(snapshot?.autoCollectCents).toBe(0);

    const payouts = await prisma.sbtpgPayout.findMany({ orderBy: { amountCents: "desc" } });
    expect(payouts).toHaveLength(2);
    expect(payouts[0]?.status).toBe("PAID");
    expect(payouts[0]?.amountCents).toBe(11_770_000);
    expect(payouts[0]?.taxpayerCount).toBe(73);
    expect(payouts[0]?.windowKind).toBe("season_to_date");
    expect(payouts[0]?.bucket).toBe("FEE_SUMMARY_PAID");
    expect(payouts[1]?.status).toBe("UNFUNDED");
    expect(payouts[1]?.amountCents).toBe(2_100_000);
    expect(payouts[1]?.windowKind).toBe("season_to_date");

    const dated = await getSbtpgCollectedTotals();
    expect(dated.collectedTodayCents).toBe(0);
    expect(dated.collectedWeekCents).toBe(0);
    expect(dated.collectedMonthCents).toBe(0);
    expect(dated.collectedAllCents).toBe(11_770_000);

    const finance = await getFinanceDashboard();
    expect(finance.totalRevenueCents).toBe(11_770_000);
    expect(finance.totalRevenueTaxpayerCount).toBe(73);
    expect(finance.totalRevenueSource).toBe("SBTPG Fee Summary PAID");
    expect(finance.unfundedCents).toBe(2_100_000);
    expect(finance.unfundedTaxpayerCount).toBe(12);
    expect(finance.fcaCents).toBe(0);
    expect(finance.autoCollectCents).toBe(0);
    expect(finance.sbtpgCollectedTodayCents).toBe(0);
    expect(finance.sbtpgCollectedWeekCents).toBe(0);
    expect(finance.collectedTodayCents).toBe(0);
    expect(finance.sbtpgCollectedAllCents).toBe(11_770_000);
  });

  it("does not add a later dated payout onto official season-to-date Total Revenue", async () => {
    await persistOfficialSbtpgFeeSummary({ ...OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22 });
    await recordSbtpgPayout({
      amountCents: 55000,
      status: "PAID",
      paidAt: new Date(),
      windowKind: "dated",
      notes: "Later dated payout — already inside season-to-date paid",
    });

    const finance = await getFinanceDashboard();
    expect(finance.totalRevenueCents).toBe(11_770_000);
    expect(finance.sbtpgCollectedTodayCents).toBe(55000);
    expect(finance.collectedTodayCents).toBe(55000);
    expect(finance.unfundedCents).toBe(2_100_000);
  });

  it("SBTPG desk reads the official snapshot for PAID and UNFUNDED", async () => {
    await persistOfficialSbtpgFeeSummary({ ...OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22 });
    const desk = await loadSbtpgDesk();
    expect(desk.official?.paidCents).toBe(11_770_000);
    expect(desk.official?.unfundedCents).toBe(2_100_000);
    expect(desk.totals.isLive).toBe(true);
    expect(desk.totals.totalRevenueCents).toBe(11_770_000);
    expect(desk.totals.paidTaxpayerCount).toBe(73);
    expect(desk.totals.unfundedCents).toBe(2_100_000);
    expect(desk.totals.unfundedTaxpayerCount).toBe(12);
    expect(desk.totals.source).toBe("SBTPG Fee Summary PAID");
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/tax/sbtpg/page.tsx"), "utf8");
    expect(page).toMatch(/loadSbtpgDesk/);
    expect(page).toMatch(/totals\.totalRevenueCents/);
    expect(page).toMatch(/totals\.unfundedCents/);
    expect(page).not.toMatch(/coming soon/i);
  });

  it("desk stays live from FEE_SUMMARY payouts after the snapshot row is removed", async () => {
    await persistOfficialSbtpgFeeSummary({ ...OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22 });
    await prisma.sbtpgFeeSummarySnapshot.deleteMany();
    const desk = await loadSbtpgDesk();
    expect(desk.official).toBeNull();
    expect(desk.totals.isLive).toBe(true);
    expect(desk.totals.totalRevenueCents).toBe(11_770_000);
    expect(desk.totals.unfundedCents).toBe(2_100_000);
    expect(desk.totals.paidTaxpayerCount).toBe(73);
    expect(desk.totals.unfundedTaxpayerCount).toBe(12);
  });
});
