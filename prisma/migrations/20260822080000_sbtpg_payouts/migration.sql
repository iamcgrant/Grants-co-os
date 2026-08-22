-- CreateTable
CREATE TABLE "SbtpgPayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT,
    "externalId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "taxYear" TEXT,
    "paidAt" DATETIME,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'staff_recorded',
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SbtpgPayout_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SbtpgPayout_status_paidAt_idx" ON "SbtpgPayout"("status", "paidAt");

-- CreateIndex
CREATE INDEX "SbtpgPayout_clientId_idx" ON "SbtpgPayout"("clientId");

-- CreateIndex
CREATE INDEX "SbtpgPayout_createdAt_idx" ON "SbtpgPayout"("createdAt");

-- CreateIndex
CREATE INDEX "SbtpgPayout_externalId_idx" ON "SbtpgPayout"("externalId");
