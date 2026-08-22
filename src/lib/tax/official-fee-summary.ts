/**
 * Official SBTPG Fee Summary — staff-captured dashboard totals.
 * Source: signed-in pro.sbtpg.com/account/dashboard. No scrape. No invented daily split.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { recordSbtpgPayout } from "@/lib/tax/payouts";

export const SBTPG_WINDOW_SEASON_TO_DATE = "season_to_date" as const;
export const SBTPG_WINDOW_DATED = "dated" as const;

export const SBTPG_BUCKET_PAYOUT = "PAYOUT" as const;
export const SBTPG_BUCKET_FEE_SUMMARY_PAID = "FEE_SUMMARY_PAID" as const;
export const SBTPG_BUCKET_FEE_SUMMARY_UNFUNDED = "FEE_SUMMARY_UNFUNDED" as const;
export const SBTPG_BUCKET_FCA = "FCA" as const;
export const SBTPG_BUCKET_AUTO_COLLECT = "AUTO_COLLECT" as const;

/**
 * Official TY 2026 Fee Summary captured 2026-08-22.
 * Do not invent any other dollar amounts.
 */
export const OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22 = {
  taxYear: "2026",
  capturedOn: "2026-08-22",
  capturedAt: "2026-08-22T12:00:00.000Z",
  sourceLabel: "SBTPG Fee Summary",
  sourceUrl: "https://pro.sbtpg.com/account/dashboard",
  paidCents: 11_770_000,
  paidTaxpayerCount: 73,
  unfundedCents: 2_100_000,
  unfundedTaxpayerCount: 12,
  fcaCents: 0,
  fcaTaxpayerCount: 0,
  autoCollectCents: 0,
  notes:
    "Staff-captured official TY 2026 Fee Summary from a signed-in pro.sbtpg.com dashboard session on 2026-08-22. Fee Summary PAID is Total Revenue. UNFUNDED is pending only. FCA $0 / 0. Auto Collect $0. No scrape. No invented daily or weekly split.",
} as const;

export type OfficialSbtpgFeeSummary = {
  taxYear: string;
  capturedOn: string;
  capturedAt: string;
  sourceLabel: string;
  sourceUrl: string | null;
  paidCents: number;
  paidTaxpayerCount: number;
  unfundedCents: number;
  unfundedTaxpayerCount: number;
  fcaCents: number;
  fcaTaxpayerCount: number;
  autoCollectCents: number;
  notes: string | null;
};

export type DatedCollectedWindows = {
  todayCents: number;
  weekCents: number;
  monthCents: number;
  allCents: number;
  count: number;
};

export type GrantsPayWindows = {
  todayCents: number;
  weekCents: number;
  monthCents: number;
};

export type CommandCenterRevenue = {
  totalRevenueCents: number;
  totalRevenueTaxpayerCount: number;
  totalRevenueSource: "SBTPG Fee Summary PAID" | "SbtpgPayout PAID/FUNDED";
  totalRevenueWindow: "season-to-date" | "recorded-payouts";
  unfundedCents: number;
  unfundedTaxpayerCount: number;
  fcaCents: number;
  fcaTaxpayerCount: number;
  autoCollectCents: number;
  collectedTodayCents: number;
  collectedWeekCents: number;
  collectedMonthCents: number;
  hasOfficialDailySplit: false;
  todayWeekEmpty: boolean;
};

export function officialPaidPayoutExternalId(summary: Pick<OfficialSbtpgFeeSummary, "taxYear" | "capturedOn">) {
  return `sbtpg:fee-summary:paid:TY${summary.taxYear}:${summary.capturedOn}`;
}

export function officialUnfundedPayoutExternalId(summary: Pick<OfficialSbtpgFeeSummary, "taxYear" | "capturedOn">) {
  return `sbtpg:fee-summary:unfunded:TY${summary.taxYear}:${summary.capturedOn}`;
}

/**
 * Command Center Total Revenue mapping.
 * Fee Summary PAID = Total Revenue / total collected.
 * UNFUNDED is pending only and is never added into Total Revenue.
 * Season-to-date official totals never invent a today/week number.
 */
export function mapCommandCenterRevenue(
  official: OfficialSbtpgFeeSummary | null,
  dated: DatedCollectedWindows,
  grantsPay: GrantsPayWindows,
): CommandCenterRevenue {
  const hasOfficial = official != null;
  const collectedTodayCents = grantsPay.todayCents + dated.todayCents;
  const collectedWeekCents = grantsPay.weekCents + dated.weekCents;
  const collectedMonthCents = grantsPay.monthCents + dated.monthCents;

  return {
    totalRevenueCents: hasOfficial ? official.paidCents : dated.allCents,
    totalRevenueTaxpayerCount: hasOfficial ? official.paidTaxpayerCount : dated.count,
    totalRevenueSource: hasOfficial ? "SBTPG Fee Summary PAID" : "SbtpgPayout PAID/FUNDED",
    totalRevenueWindow: hasOfficial ? "season-to-date" : "recorded-payouts",
    unfundedCents: official?.unfundedCents ?? 0,
    unfundedTaxpayerCount: official?.unfundedTaxpayerCount ?? 0,
    fcaCents: official?.fcaCents ?? 0,
    fcaTaxpayerCount: official?.fcaTaxpayerCount ?? 0,
    autoCollectCents: official?.autoCollectCents ?? 0,
    collectedTodayCents,
    collectedWeekCents,
    collectedMonthCents,
    hasOfficialDailySplit: false,
    todayWeekEmpty: collectedTodayCents === 0 && collectedWeekCents === 0,
  };
}

export function snapshotToOfficialSummary(row: {
  taxYear: string;
  capturedOn: string;
  capturedAt: Date;
  sourceLabel: string;
  sourceUrl: string | null;
  paidCents: number;
  paidTaxpayerCount: number;
  unfundedCents: number;
  unfundedTaxpayerCount: number;
  fcaCents: number;
  fcaTaxpayerCount: number;
  autoCollectCents: number;
  notes: string | null;
}): OfficialSbtpgFeeSummary {
  return {
    taxYear: row.taxYear,
    capturedOn: row.capturedOn,
    capturedAt: row.capturedAt.toISOString(),
    sourceLabel: row.sourceLabel,
    sourceUrl: row.sourceUrl,
    paidCents: row.paidCents,
    paidTaxpayerCount: row.paidTaxpayerCount,
    unfundedCents: row.unfundedCents,
    unfundedTaxpayerCount: row.unfundedTaxpayerCount,
    fcaCents: row.fcaCents,
    fcaTaxpayerCount: row.fcaTaxpayerCount,
    autoCollectCents: row.autoCollectCents,
    notes: row.notes,
  };
}

export async function getLatestOfficialFeeSummary(
  db: PrismaClient = defaultPrisma,
): Promise<OfficialSbtpgFeeSummary | null> {
  const row = await db.sbtpgFeeSummarySnapshot.findFirst({
    orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
  });
  return row ? snapshotToOfficialSummary(row) : null;
}

export async function persistOfficialSbtpgFeeSummary(
  input: OfficialSbtpgFeeSummary,
  options?: { recordedById?: string; db?: PrismaClient },
) {
  const db = options?.db ?? defaultPrisma;
  const capturedAt = new Date(input.capturedAt);
  if (Number.isNaN(capturedAt.getTime())) {
    throw new Error("Official Fee Summary capturedAt is invalid");
  }
  if (input.paidCents < 0 || input.unfundedCents < 0 || input.fcaCents < 0 || input.autoCollectCents < 0) {
    throw new Error("Official Fee Summary amounts cannot be negative");
  }

  const existing = await db.sbtpgFeeSummarySnapshot.findFirst({
    where: { taxYear: input.taxYear, capturedOn: input.capturedOn },
  });

  const snapshotData = {
    taxYear: input.taxYear,
    capturedOn: input.capturedOn,
    capturedAt,
    sourceLabel: input.sourceLabel,
    sourceUrl: input.sourceUrl,
    paidCents: input.paidCents,
    paidTaxpayerCount: input.paidTaxpayerCount,
    unfundedCents: input.unfundedCents,
    unfundedTaxpayerCount: input.unfundedTaxpayerCount,
    fcaCents: input.fcaCents,
    fcaTaxpayerCount: input.fcaTaxpayerCount,
    autoCollectCents: input.autoCollectCents,
    notes: input.notes,
    recordedById: options?.recordedById ?? null,
  };

  const snapshot = existing
    ? await db.sbtpgFeeSummarySnapshot.update({ where: { id: existing.id }, data: snapshotData })
    : await db.sbtpgFeeSummarySnapshot.create({ data: snapshotData });

  const paidPayout = await recordSbtpgPayout({
    amountCents: input.paidCents,
    status: "PAID",
    externalId: officialPaidPayoutExternalId(input),
    taxYear: input.taxYear,
    paidAt: capturedAt,
    source: "official_import",
    windowKind: SBTPG_WINDOW_SEASON_TO_DATE,
    bucket: SBTPG_BUCKET_FEE_SUMMARY_PAID,
    taxpayerCount: input.paidTaxpayerCount,
    notes: input.notes,
    recordedById: options?.recordedById,
  });

  const unfundedPayout =
    input.unfundedCents > 0
      ? await recordSbtpgPayout({
          amountCents: input.unfundedCents,
          status: "UNFUNDED",
          externalId: officialUnfundedPayoutExternalId(input),
          taxYear: input.taxYear,
          paidAt: capturedAt,
          source: "official_import",
          windowKind: SBTPG_WINDOW_SEASON_TO_DATE,
          bucket: SBTPG_BUCKET_FEE_SUMMARY_UNFUNDED,
          taxpayerCount: input.unfundedTaxpayerCount,
          notes: input.notes,
          recordedById: options?.recordedById,
        })
      : null;

  return { snapshot, paidPayout, unfundedPayout };
}

export function officialFeeSummaryFromCaptureKey(key: string): OfficialSbtpgFeeSummary {
  if (key === OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22.capturedOn || key === "TY2026-2026-08-22") {
    return { ...OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22 };
  }
  throw new Error("Unknown official SBTPG Fee Summary capture");
}
