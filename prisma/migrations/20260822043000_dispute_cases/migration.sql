-- CreateTable
CREATE TABLE "DisputeCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INTAKE',
    "title" TEXT NOT NULL,
    "packetNotes" TEXT,
    "externalRef" TEXT,
    "outcome" TEXT,
    "outcomeNote" TEXT,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "packetReadyAt" DATETIME,
    "readyAt" DATETIME,
    "submittedAt" DATETIME,
    "resultsAt" DATETIME,
    "closedAt" DATETIME,
    "actorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DisputeCase_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DisputeCase_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DisputeCaseItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "bureau" TEXT,
    "accountRef" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DisputeCaseItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DisputeCaseCheckItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" DATETIME,
    "doneById" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DisputeCaseCheckItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DisputeCase_channel_status_idx" ON "DisputeCase"("channel", "status");

-- CreateIndex
CREATE INDEX "DisputeCase_clientId_channel_idx" ON "DisputeCase"("clientId", "channel");

-- CreateIndex
CREATE INDEX "DisputeCaseItem_caseId_idx" ON "DisputeCaseItem"("caseId");

-- CreateIndex
CREATE INDEX "DisputeCaseCheckItem_caseId_idx" ON "DisputeCaseCheckItem"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "DisputeCaseCheckItem_caseId_key_key" ON "DisputeCaseCheckItem"("caseId", "key");
