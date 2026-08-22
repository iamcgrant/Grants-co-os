/**
 * Persist the staff-captured official SBTPG Fee Summary into Postgres/SQLite.
 * Production: DATABASE_URL=postgresql://... npx tsx scripts/ingest-sbtpg-fee-summary.ts
 *
 * Writes SbtpgFeeSummarySnapshot + matching SbtpgPayout PAID / UNFUNDED rows.
 * Command Center Total Revenue = Fee Summary PAID. No scrape. No invented daily split.
 */
import "dotenv/config";
import {
  OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22,
  persistOfficialSbtpgFeeSummary,
} from "../src/lib/tax/official-fee-summary";
import { prisma } from "../src/lib/db/prisma";

async function main() {
  const official = { ...OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22 };
  const result = await persistOfficialSbtpgFeeSummary(official);
  console.log(
    JSON.stringify(
      {
        ok: true,
        scrape: false,
        mapping: {
          totalRevenue: "SBTPG Fee Summary PAID",
          paidCents: official.paidCents,
          paidTaxpayerCount: official.paidTaxpayerCount,
          unfundedExcludedFromTotalRevenue: true,
          unfundedCents: official.unfundedCents,
          unfundedTaxpayerCount: official.unfundedTaxpayerCount,
        },
        snapshotId: result.snapshot.id,
        paidPayoutId: result.paidPayout.id,
        unfundedPayoutId: result.unfundedPayout?.id ?? null,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "ingest_failed");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
