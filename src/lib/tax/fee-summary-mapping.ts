/**
 * Official SBTPG Fee Summary mapping — no I/O, no scrape.
 * Source: signed-in pro.sbtpg.com/account/dashboard. No invented daily split.
 */

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

export function officialFeeSummaryFromCaptureKey(key: string): OfficialSbtpgFeeSummary {
  if (key === OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22.capturedOn || key === "TY2026-2026-08-22") {
    return { ...OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22 };
  }
  throw new Error("Unknown official SBTPG Fee Summary capture");
}
