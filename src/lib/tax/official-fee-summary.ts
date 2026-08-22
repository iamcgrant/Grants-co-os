/**
 * Persist / read official SBTPG Fee Summary snapshots. No scrape.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { recordSbtpgPayout } from "@/lib/tax/payouts";
import {
  SBTPG_BUCKET_FEE_SUMMARY_PAID,
  SBTPG_BUCKET_FEE_SUMMARY_UNFUNDED,
  SBTPG_WINDOW_SEASON_TO_DATE,
  officialPaidPayoutExternalId,
  officialUnfundedPayoutExternalId,
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
  mapCommandCenterRevenue,
  officialFeeSummaryFromCaptureKey,
  officialPaidPayoutExternalId,
  officialUnfundedPayoutExternalId,
  type CommandCenterRevenue,
  type DatedCollectedWindows,
  type GrantsPayWindows,
  type OfficialSbtpgFeeSummary,
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
