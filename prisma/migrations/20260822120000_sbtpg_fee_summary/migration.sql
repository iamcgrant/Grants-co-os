-- AlterTable
ALTER TABLE "SbtpgPayout" ADD COLUMN "windowKind" TEXT NOT NULL DEFAULT 'dated';
ALTER TABLE "SbtpgPayout" ADD COLUMN "bucket" TEXT NOT NULL DEFAULT 'PAYOUT';
ALTER TABLE "SbtpgPayout" ADD COLUMN "taxpayerCount" INTEGER;

-- CreateIndex
CREATE INDEX "SbtpgPayout_windowKind_bucket_idx" ON "SbtpgPayout"("windowKind", "bucket");

-- CreateTable
CREATE TABLE "SbtpgFeeSummarySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxYear" TEXT NOT NULL,
    "capturedOn" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL,
    "sourceLabel" TEXT NOT NULL DEFAULT 'SBTPG Fee Summary',
    "sourceUrl" TEXT,
    "paidCents" INTEGER NOT NULL,
    "paidTaxpayerCount" INTEGER NOT NULL,
    "unfundedCents" INTEGER NOT NULL,
    "unfundedTaxpayerCount" INTEGER NOT NULL,
    "fcaCents" INTEGER NOT NULL DEFAULT 0,
    "fcaTaxpayerCount" INTEGER NOT NULL DEFAULT 0,
    "autoCollectCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SbtpgFeeSummarySnapshot_taxYear_capturedOn_key" ON "SbtpgFeeSummarySnapshot"("taxYear", "capturedOn");

-- CreateIndex
CREATE INDEX "SbtpgFeeSummarySnapshot_taxYear_capturedAt_idx" ON "SbtpgFeeSummarySnapshot"("taxYear", "capturedAt");
