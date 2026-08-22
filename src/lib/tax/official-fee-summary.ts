/**
 * Persist / read official SBTPG Fee Summary snapshots. No scrape.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { recordSbtpgPayout } from "@/lib/tax/payouts";
import {
  officialFeeSummaryPersistRows,
  type OfficialSbtpgFeeSummary,
} from "@/lib/tax/fee-summary-mapping";

export {
  OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22,
  SBTPG_BUCKET_AUTO_COLLECT,
  SBTPG_BUCKET_FCA,
  SBTPG_BUCKET_FEE_SUMMARY_PAID,
  SBTPG_BUCKET_FEE_SUMMARY_UNFUNDED,
  SBTPG_BUCKET_PAYOUT,
  SBTPG_WINDOW_DATED,
  SBTPG_WINDOW_SEASON_TO_DATE,
  commandCenterChartMatchesTotal,
  commandCenterRevenueSeries,
  COMMAND_CENTER_SEASON_LABEL,
  mapCommandCenterRevenue,
  officialFeeSummaryFromCaptureKey,
  officialFeeSummaryPersistRows,
  officialPaidPayoutExternalId,
  officialSummaryFromFeeSummaryPayouts,
  officialUnfundedPayoutExternalId,
  sbtpgDeskTotals,
  type CommandCenterRevenue,
  type DatedCollectedWindows,
  type GrantsPayWindows,
  type OfficialFeeSummaryPersistRows,
  type OfficialSbtpgFeeSummary,
  type SbtpgDeskTotals,
} from "@/lib/tax/fee-summary-mapping";

function snapshotToOfficialSummary(row: {
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

  const rows = officialFeeSummaryPersistRows(input);
  const existing = await db.sbtpgFeeSummarySnapshot.findFirst({
    where: { taxYear: rows.snapshot.taxYear, capturedOn: rows.snapshot.capturedOn },
  });

  const snapshotData = {
    taxYear: rows.snapshot.taxYear,
    capturedOn: rows.snapshot.capturedOn,
    capturedAt,
    sourceLabel: rows.snapshot.sourceLabel,
    sourceUrl: rows.snapshot.sourceUrl,
    paidCents: rows.snapshot.paidCents,
    paidTaxpayerCount: rows.snapshot.paidTaxpayerCount,
    unfundedCents: rows.snapshot.unfundedCents,
    unfundedTaxpayerCount: rows.snapshot.unfundedTaxpayerCount,
    fcaCents: rows.snapshot.fcaCents,
    fcaTaxpayerCount: rows.snapshot.fcaTaxpayerCount,
    autoCollectCents: rows.snapshot.autoCollectCents,
    notes: rows.snapshot.notes,
    recordedById: options?.recordedById ?? null,
  };

  const snapshot = existing
    ? await db.sbtpgFeeSummarySnapshot.update({ where: { id: existing.id }, data: snapshotData })
    : await db.sbtpgFeeSummarySnapshot.create({ data: snapshotData });

  const paidPayout = await recordSbtpgPayout({
    amountCents: rows.paidPayout.amountCents,
    status: rows.paidPayout.status,
    externalId: rows.paidPayout.externalId,
    taxYear: rows.paidPayout.taxYear,
    paidAt: capturedAt,
    source: rows.paidPayout.source,
    windowKind: rows.paidPayout.windowKind,
    bucket: rows.paidPayout.bucket,
    taxpayerCount: rows.paidPayout.taxpayerCount,
    notes: rows.snapshot.notes,
    recordedById: options?.recordedById,
  });

  const unfundedPayout = rows.unfundedPayout
    ? await recordSbtpgPayout({
        amountCents: rows.unfundedPayout.amountCents,
        status: rows.unfundedPayout.status,
        externalId: rows.unfundedPayout.externalId,
        taxYear: rows.unfundedPayout.taxYear,
        paidAt: capturedAt,
        source: rows.unfundedPayout.source,
        windowKind: rows.unfundedPayout.windowKind,
        bucket: rows.unfundedPayout.bucket,
        taxpayerCount: rows.unfundedPayout.taxpayerCount,
        notes: rows.snapshot.notes,
        recordedById: options?.recordedById,
      })
    : null;

  return { snapshot, paidPayout, unfundedPayout };
}
