-- Align migration history with schema.prisma: User.mustChangePassword and
-- Client.referredByPartnerId FK were in the datamodel but missing from migrate history.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grantsClientId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "stage" TEXT NOT NULL DEFAULT 'NEW_ENROLLMENT',
    "nextAction" TEXT,
    "nextActionOwner" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "lastInteractionAt" DATETIME,
    "nextDueAt" DATETIME,
    "duplicateFlag" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "acquisitionStage" TEXT,
    "acquisitionSource" TEXT,
    "acquisitionMarket" TEXT,
    "grantsLeadScore" INTEGER,
    "grantsLeadScoreReasonsJson" TEXT,
    "referredByPartnerId" TEXT,
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Client_referredByPartnerId_fkey" FOREIGN KEY ("referredByPartnerId") REFERENCES "Partner" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Client" ("acquisitionMarket", "acquisitionSource", "acquisitionStage", "createdAt", "doNotContact", "duplicateFlag", "email", "emailNormalized", "firstName", "grantsClientId", "grantsLeadScore", "grantsLeadScoreReasonsJson", "id", "lastInteractionAt", "lastName", "nextAction", "nextActionOwner", "nextDueAt", "notes", "phone", "phoneNormalized", "referredByPartnerId", "stage", "status", "unsubscribed", "updatedAt", "urgency", "userId") SELECT "acquisitionMarket", "acquisitionSource", "acquisitionStage", "createdAt", "doNotContact", "duplicateFlag", "email", "emailNormalized", "firstName", "grantsClientId", "grantsLeadScore", "grantsLeadScoreReasonsJson", "id", "lastInteractionAt", "lastName", "nextAction", "nextActionOwner", "nextDueAt", "notes", "phone", "phoneNormalized", "referredByPartnerId", "stage", "status", "unsubscribed", "updatedAt", "urgency", "userId" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE UNIQUE INDEX "Client_grantsClientId_key" ON "Client"("grantsClientId");
CREATE UNIQUE INDEX "Client_userId_key" ON "Client"("userId");
CREATE INDEX "Client_phoneNormalized_idx" ON "Client"("phoneNormalized");
CREATE INDEX "Client_lastName_firstName_idx" ON "Client"("lastName", "firstName");
CREATE INDEX "Client_acquisitionStage_idx" ON "Client"("acquisitionStage");
CREATE INDEX "Client_acquisitionSource_idx" ON "Client"("acquisitionSource");
CREATE INDEX "Client_acquisitionMarket_idx" ON "Client"("acquisitionMarket");
CREATE INDEX "Client_referredByPartnerId_idx" ON "Client"("referredByPartnerId");
CREATE UNIQUE INDEX "Client_emailNormalized_key" ON "Client"("emailNormalized");
CREATE TABLE "new_Partner" (
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
    "market" TEXT NOT NULL,
    "grantsLeadScore" INTEGER,
    "grantsLeadScoreReasonsJson" TEXT,
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Partner" ("acquisitionSource", "businessName", "contactFirstName", "contactLastName", "createdAt", "doNotContact", "email", "emailNormalized", "grantsLeadScore", "grantsLeadScoreReasonsJson", "id", "market", "notes", "partnerType", "phone", "phoneNormalized", "pipelineStage", "unsubscribed", "updatedAt") SELECT "acquisitionSource", "businessName", "contactFirstName", "contactLastName", "createdAt", "doNotContact", "email", "emailNormalized", "grantsLeadScore", "grantsLeadScoreReasonsJson", "id", "market", "notes", "partnerType", "phone", "phoneNormalized", "pipelineStage", "unsubscribed", "updatedAt" FROM "Partner";
DROP TABLE "Partner";
ALTER TABLE "new_Partner" RENAME TO "Partner";
CREATE INDEX "Partner_pipelineStage_idx" ON "Partner"("pipelineStage");
CREATE INDEX "Partner_emailNormalized_idx" ON "Partner"("emailNormalized");
CREATE INDEX "Partner_phoneNormalized_idx" ON "Partner"("phoneNormalized");
CREATE INDEX "Partner_market_idx" ON "Partner"("market");
CREATE TABLE "new_PartnerReferral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partnerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerReferral_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartnerReferral_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PartnerReferral" ("clientId", "createdAt", "id", "market", "partnerId") SELECT "clientId", "createdAt", "id", "market", "partnerId" FROM "PartnerReferral";
DROP TABLE "PartnerReferral";
ALTER TABLE "new_PartnerReferral" RENAME TO "PartnerReferral";
CREATE INDEX "PartnerReferral_partnerId_idx" ON "PartnerReferral"("partnerId");
CREATE INDEX "PartnerReferral_clientId_idx" ON "PartnerReferral"("clientId");
CREATE INDEX "PartnerReferral_market_idx" ON "PartnerReferral"("market");
CREATE UNIQUE INDEX "PartnerReferral_partnerId_clientId_key" ON "PartnerReferral"("partnerId", "clientId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "firstName", "id", "isActive", "lastLoginAt", "lastName", "mfaEnabled", "mfaSecret", "passwordHash", "role", "updatedAt") SELECT "createdAt", "email", "firstName", "id", "isActive", "lastLoginAt", "lastName", "mfaEnabled", "mfaSecret", "passwordHash", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
