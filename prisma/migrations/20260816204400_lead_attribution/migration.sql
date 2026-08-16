-- CreateEnum
-- AttributionSource / AttributionShowStatus are stored as TEXT on SQLite.

-- CreateTable
CREATE TABLE "LeadAttribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "platform" TEXT,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "contentId" TEXT,
    "adId" TEXT,
    "cta" TEXT,
    "leadAt" DATETIME,
    "consultBookedAt" DATETIME,
    "showStatus" TEXT NOT NULL DEFAULT 'unknown',
    "converted" BOOLEAN,
    "service" TEXT,
    "amountCollected" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeadAttribution_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LeadAttribution_clientId_idx" ON "LeadAttribution"("clientId");

-- CreateIndex
CREATE INDEX "LeadAttribution_source_idx" ON "LeadAttribution"("source");

-- CreateIndex
CREATE INDEX "LeadAttribution_campaignId_idx" ON "LeadAttribution"("campaignId");

-- CreateIndex
CREATE INDEX "LeadAttribution_contentId_idx" ON "LeadAttribution"("contentId");
