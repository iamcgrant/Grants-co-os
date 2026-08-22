/**
 * Official SBTPG Fee Summary mapping — no I/O, no scrape.
 * Source: signed-in pro.sbtpg.com/account/dashboard. No invented daily split.
 */

import { STAFF_REVENUE_ATTRIBUTION } from "@/lib/tax/staff-revenue-copy";

export { STAFF_REVENUE_ATTRIBUTION } from "@/lib/tax/staff-revenue-copy";

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

export type FeeSummaryPayoutRow = {
  status: string;
  amountCents: number;
  bucket?: string | null;
  taxpayerCount?: number | null;
  taxYear?: string | null;
  paidAt?: Date | string | null;
};

/** Rebuild official totals from FEE_SUMMARY_* payouts when the snapshot row is missing. */
export function officialSummaryFromFeeSummaryPayouts(
  payouts: ReadonlyArray<FeeSummaryPayoutRow>,
): OfficialSbtpgFeeSummary | null {
  const paid = payouts.find((row) => row.bucket === SBTPG_BUCKET_FEE_SUMMARY_PAID);
  if (!paid) return null;
  const unfunded = payouts.find((row) => row.bucket === SBTPG_BUCKET_FEE_SUMMARY_UNFUNDED);
  const capturedAt = paid.paidAt ? new Date(paid.paidAt) : null;
  return {
    taxYear: paid.taxYear || "",
    capturedOn: capturedAt && !Number.isNaN(capturedAt.getTime()) ? capturedAt.toISOString().slice(0, 10) : "",
    capturedAt: capturedAt && !Number.isNaN(capturedAt.getTime()) ? capturedAt.toISOString() : "",
    sourceLabel: "SBTPG Fee Summary",
    sourceUrl: null,
    paidCents: paid.amountCents,
    paidTaxpayerCount: paid.taxpayerCount ?? 0,
    unfundedCents: unfunded?.amountCents ?? 0,
    unfundedTaxpayerCount: unfunded?.taxpayerCount ?? 0,
    fcaCents: 0,
    fcaTaxpayerCount: 0,
    autoCollectCents: 0,
    notes: null,
  };
}

/** Season-to-date chart uses the official total on every point — no invented daily split. */
export function commandCenterRevenueSeries(
  officialTotalCents: number | null,
  labels: string[],
  datedValues: number[],
): { labels: string[]; values: number[] } {
  if (officialTotalCents != null && officialTotalCents > 0) {
    return { labels, values: labels.map(() => officialTotalCents) };
  }
  return { labels, values: datedValues };
}

export function officialFeeSummaryFromCaptureKey(key: string): OfficialSbtpgFeeSummary {
  if (key === OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22.capturedOn || key === "TY2026-2026-08-22") {
    return { ...OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22 };
  }
  throw new Error("Unknown official SBTPG Fee Summary capture");
}

export type OfficialFeeSummaryPersistPayout = {
  amountCents: number;
  status: "PAID" | "UNFUNDED";
  bucket: typeof SBTPG_BUCKET_FEE_SUMMARY_PAID | typeof SBTPG_BUCKET_FEE_SUMMARY_UNFUNDED;
  windowKind: typeof SBTPG_WINDOW_SEASON_TO_DATE;
  taxpayerCount: number;
  externalId: string;
  taxYear: string;
  paidAt: string;
  source: "official_import";
};

export type OfficialFeeSummaryPersistRows = {
  snapshot: OfficialSbtpgFeeSummary;
  paidPayout: OfficialFeeSummaryPersistPayout;
  unfundedPayout: OfficialFeeSummaryPersistPayout | null;
};

/**
 * Map an official Fee Summary capture onto SbtpgFeeSummarySnapshot + matching
 * SbtpgPayout rows. Amounts come from the capture only — never invented.
 */
export function officialFeeSummaryPersistRows(
  summary: OfficialSbtpgFeeSummary,
): OfficialFeeSummaryPersistRows {
  return {
    snapshot: { ...summary },
    paidPayout: {
      amountCents: summary.paidCents,
      status: "PAID",
      bucket: SBTPG_BUCKET_FEE_SUMMARY_PAID,
      windowKind: SBTPG_WINDOW_SEASON_TO_DATE,
      taxpayerCount: summary.paidTaxpayerCount,
      externalId: officialPaidPayoutExternalId(summary),
      taxYear: summary.taxYear,
      paidAt: summary.capturedAt,
      source: "official_import",
    },
    unfundedPayout:
      summary.unfundedCents > 0
        ? {
            amountCents: summary.unfundedCents,
            status: "UNFUNDED",
            bucket: SBTPG_BUCKET_FEE_SUMMARY_UNFUNDED,
            windowKind: SBTPG_WINDOW_SEASON_TO_DATE,
            taxpayerCount: summary.unfundedTaxpayerCount,
            externalId: officialUnfundedPayoutExternalId(summary),
            taxYear: summary.taxYear,
            paidAt: summary.capturedAt,
            source: "official_import",
          }
        : null,
  };
}

export type SbtpgDeskTotals = {
  isLive: boolean;
  totalRevenueCents: number;
  paidTaxpayerCount: number;
  unfundedCents: number;
  unfundedTaxpayerCount: number;
  source: "SBTPG Fee Summary PAID" | "SbtpgPayout PAID/FUNDED";
  staffAttribution: typeof STAFF_REVENUE_ATTRIBUTION;
  window: "season-to-date" | "recorded-payouts";
  taxYear: string | null;
  capturedOn: string | null;
};

/**
 * Native SBTPG desk tiles. Official snapshot wins — same PAID/UNFUNDED as Command Center.
 */
export function sbtpgDeskTotals(
  official: OfficialSbtpgFeeSummary | null,
  payouts: ReadonlyArray<FeeSummaryPayoutRow>,
  board: ReadonlyArray<{ status: string | null }>,
): SbtpgDeskTotals {
  const liveOfficial = official ?? officialSummaryFromFeeSummaryPayouts(payouts);
  const trackedCents = payouts
    .filter((row) => row.status === "PAID" || row.status === "FUNDED")
    .reduce((sum, row) => sum + row.amountCents, 0);
  const paidFromBoard = board.filter((row) => row.status === "PAID" || row.status === "FUNDED").length;
  const openFromBoard = board.filter(
    (row) => row.status && row.status !== "CLOSED" && row.status !== "PAID",
  ).length;

  if (liveOfficial) {
    return {
      isLive: true,
      totalRevenueCents: liveOfficial.paidCents,
      paidTaxpayerCount: liveOfficial.paidTaxpayerCount,
      unfundedCents: liveOfficial.unfundedCents,
      unfundedTaxpayerCount: liveOfficial.unfundedTaxpayerCount,
      source: "SBTPG Fee Summary PAID",
      staffAttribution: STAFF_REVENUE_ATTRIBUTION,
      window: "season-to-date",
      taxYear: liveOfficial.taxYear || null,
      capturedOn: liveOfficial.capturedOn || null,
    };
  }

  return {
    isLive: trackedCents > 0 || payouts.length > 0,
    totalRevenueCents: trackedCents,
    paidTaxpayerCount: paidFromBoard,
    unfundedCents: 0,
    unfundedTaxpayerCount: openFromBoard,
    source: "SbtpgPayout PAID/FUNDED",
    staffAttribution: STAFF_REVENUE_ATTRIBUTION,
    window: "recorded-payouts",
    taxYear: null,
    capturedOn: null,
  };
}
