-- Acquisition command center scaffolding.
-- Partner / PartnerReferral / Client acquisition fields.
-- Enums are stored as TEXT on SQLite. No live GHL writes.

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessName" TEXT NOT NULL,
    "contactFirstName" TEXT,
    "contactLastName" TEXT,
    "email" TEXT,
    "emailNormalized" TEXT,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "partnerType" TEXT,
    "pipelineStage" TEXT NOT NULL DEFAULT 'NEW_PROSPECT',
    "acquisitionSource" TEXT,
    "grantsLeadScore" INTEGER,
    "grantsLeadScoreReasonsJson" TEXT,
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Partner_pipelineStage_idx" ON "Partner"("pipelineStage");

-- CreateIndex
CREATE INDEX "Partner_emailNormalized_idx" ON "Partner"("emailNormalized");

-- CreateIndex
CREATE INDEX "Partner_phoneNormalized_idx" ON "Partner"("phoneNormalized");

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "acquisitionStage" TEXT;
ALTER TABLE "Client" ADD COLUMN "acquisitionSource" TEXT;
ALTER TABLE "Client" ADD COLUMN "grantsLeadScore" INTEGER;
ALTER TABLE "Client" ADD COLUMN "grantsLeadScoreReasonsJson" TEXT;
ALTER TABLE "Client" ADD COLUMN "referredByPartnerId" TEXT;
ALTER TABLE "Client" ADD COLUMN "doNotContact" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN "unsubscribed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Client_acquisitionStage_idx" ON "Client"("acquisitionStage");

-- CreateIndex
CREATE INDEX "Client_acquisitionSource_idx" ON "Client"("acquisitionSource");

-- CreateIndex
CREATE INDEX "Client_referredByPartnerId_idx" ON "Client"("referredByPartnerId");

-- CreateTable
CREATE TABLE "PartnerReferral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partnerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerReferral_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartnerReferral_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerReferral_partnerId_clientId_key" ON "PartnerReferral"("partnerId", "clientId");

-- CreateIndex
CREATE INDEX "PartnerReferral_partnerId_idx" ON "PartnerReferral"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerReferral_clientId_idx" ON "PartnerReferral"("clientId");
