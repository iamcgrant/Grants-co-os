-- Acquisition city/market dimension (Charles-locked vocabulary).
-- PRIMARY + SECONDARY + UNKNOWN/OTHER. Estill, SC is not a member.
-- Enums are stored as TEXT on SQLite. No live GHL writes.

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN "market" TEXT NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "PartnerReferral" ADD COLUMN "market" TEXT NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "acquisitionMarket" TEXT;

-- AlterTable
ALTER TABLE "LeadAttribution" ADD COLUMN "market" TEXT;

-- CreateIndex
CREATE INDEX "Partner_market_idx" ON "Partner"("market");

-- CreateIndex
CREATE INDEX "PartnerReferral_market_idx" ON "PartnerReferral"("market");

-- CreateIndex
CREATE INDEX "Client_acquisitionMarket_idx" ON "Client"("acquisitionMarket");

-- CreateIndex
CREATE INDEX "LeadAttribution_market_idx" ON "LeadAttribution"("market");
