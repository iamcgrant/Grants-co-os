import { startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { getSbtpgCollectedTotals } from "@/lib/tax/payouts";
import { getLatestOfficialFeeSummary, mapCommandCenterRevenue } from "@/lib/tax/official-fee-summary";

function moneySum(
  rows: { amountCents: number }[],
): number {
  return rows.reduce((s, r) => s + r.amountCents, 0);
}

/**
 * Owner financial health dashboard.
 * Distinguishes: payment successful vs settled vs paid out.
 * Does NOT invent bank/processor balances.
 */
export async function getFinanceDashboard() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const [
    collectedToday,
    collectedWeek,
    collectedMonth,
    outstanding,
    failed,
    pendingSettlement,
    refunds,
    chargebacks,
    settled,
    payouts,
  ] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: { status: "SUCCEEDED", createdAt: { gte: todayStart } },
      select: { amountCents: true },
    }),
    prisma.paymentTransaction.findMany({
      where: { status: "SUCCEEDED", createdAt: { gte: weekStart } },
      select: { amountCents: true },
    }),
    prisma.paymentTransaction.findMany({
      where: { status: "SUCCEEDED", createdAt: { gte: monthStart } },
      select: { amountCents: true },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["DUE", "FAILED", "PROCESSING"] } },
      select: { amountCents: true, amountPaidCents: true },
    }),
    prisma.paymentTransaction.findMany({
      where: { status: "FAILED", createdAt: { gte: monthStart } },
      select: { amountCents: true },
    }),
    prisma.paymentTransaction.findMany({
      where: {
        status: "SUCCEEDED",
        settlementStatus: { in: ["UNSETTLED", "PENDING"] },
      },
      select: { amountCents: true },
    }),
    prisma.refund.findMany({
      where: { createdAt: { gte: monthStart }, status: "SUCCEEDED" },
      select: { amountCents: true },
    }),
    prisma.paymentDispute.findMany({
      where: { status: { in: ["OPEN", "NEEDS_RESPONSE", "UNDER_REVIEW"] } },
      select: { amountCents: true },
    }),
    prisma.paymentTransaction.findMany({
      where: { status: "SUCCEEDED", settlementStatus: "SETTLED" },
      select: { amountCents: true },
    }),
    prisma.payout.findMany({
      where: { status: { in: ["PENDING", "IN_TRANSIT", "PAID"] } },
      select: { amountCents: true, status: true },
    }),
  ]);

  const outstandingCents = outstanding.reduce(
    (s, i) => s + (i.amountCents - i.amountPaidCents),
    0,
  );

  const grantsPayTodayCents = moneySum(collectedToday);
  const grantsPayWeekCents = moneySum(collectedWeek);
  const grantsPayMonthCents = moneySum(collectedMonth);
  const [sbtpg, official] = await Promise.all([
    getSbtpgCollectedTotals(now, {
      today: todayStart,
      week: weekStart,
      month: monthStart,
    }),
    getLatestOfficialFeeSummary(),
  ]);
  const revenue = mapCommandCenterRevenue(
    official,
    {
      todayCents: sbtpg.collectedTodayCents,
      weekCents: sbtpg.collectedWeekCents,
      monthCents: sbtpg.collectedMonthCents,
      allCents: sbtpg.collectedAllCents,
      count: sbtpg.payoutCount,
    },
    {
      todayCents: grantsPayTodayCents,
      weekCents: grantsPayWeekCents,
      monthCents: grantsPayMonthCents,
    },
  );
  const collectedTodayCents = revenue.collectedTodayCents;
  const collectedWeekCents = revenue.collectedWeekCents;
  const collectedMonthCents = revenue.collectedMonthCents;
  const refundsMonthCents = moneySum(refunds);
  const netProcessed = collectedMonthCents - refundsMonthCents;

  return {
    collectedTodayCents,
    collectedWeekCents,
    collectedMonthCents,
    grantsPayTodayCents,
    grantsPayWeekCents,
    grantsPayMonthCents,
    totalRevenueCents: revenue.totalRevenueCents,
    totalRevenueTaxpayerCount: revenue.totalRevenueTaxpayerCount,
    totalRevenueSource: revenue.totalRevenueSource,
    totalRevenueWindow: revenue.totalRevenueWindow,
    unfundedCents: revenue.unfundedCents,
    unfundedTaxpayerCount: revenue.unfundedTaxpayerCount,
    fcaCents: revenue.fcaCents,
    fcaTaxpayerCount: revenue.fcaTaxpayerCount,
    autoCollectCents: revenue.autoCollectCents,
    hasOfficialDailySplit: revenue.hasOfficialDailySplit,
    todayWeekEmpty: revenue.todayWeekEmpty,
    sbtpgCollectedTodayCents: sbtpg.collectedTodayCents,
    sbtpgCollectedWeekCents: sbtpg.collectedWeekCents,
    sbtpgCollectedMonthCents: sbtpg.collectedMonthCents,
    sbtpgCollectedAllCents: revenue.totalRevenueCents,
    sbtpgPayoutCount: revenue.totalRevenueTaxpayerCount,
    outstandingCents,
    failedPaymentsCents: moneySum(failed),
    pendingSettlementCents: moneySum(pendingSettlement),
    refundsMonthCents,
    chargebacksOpenCents: moneySum(chargebacks),
    netProcessedCents: netProcessed,
    settledCents: moneySum(settled),
    payoutsPendingCents: moneySum(
      payouts.filter((p) => p.status === "PENDING" || p.status === "IN_TRANSIT"),
    ),
    payoutsPaidCents: moneySum(payouts.filter((p) => p.status === "PAID")),
    asOf: now.toISOString(),
    notes: {
      collected:
        "Total Revenue is official SBTPG Fee Summary PAID when a snapshot exists. Today/week stay empty unless a dated payout or Grants Pay charge exists. No invented daily split. No portal scrape.",
      settled: "Settlement confirmed by processor.",
      payout: "Payout to merchant account — separate from settlement.",
      deposited: "Bank deposit confirmation requires processor payout reconciliation.",
      sbtpg:
        "Total Revenue = SBTPG Fee Summary PAID (season-to-date). UNFUNDED is pending and is not added. FCA and Auto Collect are official snapshot fields only. No scrape of pro.sbtpg.com.",
    },
  };
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
