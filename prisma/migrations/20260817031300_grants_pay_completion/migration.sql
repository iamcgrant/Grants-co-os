-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "amountPaidCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "serviceName" TEXT,
    "description" TEXT,
    "dueAt" DATETIME,
    "notes" TEXT,
    "allowPartial" BOOLEAN NOT NULL DEFAULT false,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringDays" INTEGER,
    "provider" TEXT NOT NULL DEFAULT 'commas',
    "createdByUserId" TEXT,
    "sentAt" DATETIME,
    "paidAt" DATETIME,
    "canceledAt" DATETIME,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentRequest_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentRequestNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentRequestId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentRequestNote_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentRequestId" TEXT,
    "invoiceId" TEXT,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ONE_TIME',
    "provider" TEXT NOT NULL,
    "providerSessionId" TEXT,
    "providerCheckoutId" TEXT,
    "url" TEXT NOT NULL,
    "osPayPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" DATETIME,
    "lastSentChannel" TEXT,
    "lastSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentLink_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PaymentLink_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PaymentLink_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OnboardingToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "serviceName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "revokedAt" DATETIME,
    "prefillJson" TEXT,
    "answersJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OnboardingToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "clientId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "idempotencyKey" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" DATETIME,
    "errorMessage" TEXT,
    "resultJson" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AutomationRun_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExceptionTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "clientId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExceptionTicket_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemHealthCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "component" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "lastSuccessAt" DATETIME,
    "lastFailureAt" DATETIME,
    "lastCheckedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_publicId_key" ON "PaymentRequest"("publicId");

-- CreateIndex
CREATE INDEX "PaymentRequest_clientId_status_idx" ON "PaymentRequest"("clientId", "status");

-- CreateIndex
CREATE INDEX "PaymentRequest_invoiceId_idx" ON "PaymentRequest"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentRequest_status_dueAt_idx" ON "PaymentRequest"("status", "dueAt");

-- CreateIndex
CREATE INDEX "PaymentRequestNote_paymentRequestId_idx" ON "PaymentRequestNote"("paymentRequestId");

-- CreateIndex
CREATE INDEX "PaymentLink_clientId_idx" ON "PaymentLink"("clientId");

-- CreateIndex
CREATE INDEX "PaymentLink_invoiceId_idx" ON "PaymentLink"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentLink_provider_providerSessionId_idx" ON "PaymentLink"("provider", "providerSessionId");

-- CreateIndex
CREATE INDEX "PaymentLink_paymentRequestId_idx" ON "PaymentLink"("paymentRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingToken_tokenHash_key" ON "OnboardingToken"("tokenHash");

-- CreateIndex
CREATE INDEX "OnboardingToken_clientId_idx" ON "OnboardingToken"("clientId");

-- CreateIndex
CREATE INDEX "OnboardingToken_expiresAt_idx" ON "OnboardingToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRun_idempotencyKey_key" ON "AutomationRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AutomationRun_kind_status_idx" ON "AutomationRun"("kind", "status");

-- CreateIndex
CREATE INDEX "AutomationRun_status_nextRetryAt_idx" ON "AutomationRun"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "AutomationRun_clientId_idx" ON "AutomationRun"("clientId");

-- CreateIndex
CREATE INDEX "ExceptionTicket_status_severity_idx" ON "ExceptionTicket"("status", "severity");

-- CreateIndex
CREATE INDEX "ExceptionTicket_clientId_idx" ON "ExceptionTicket"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemHealthCheck_component_key" ON "SystemHealthCheck"("component");

-- CreateIndex
CREATE INDEX "SystemHealthCheck_status_idx" ON "SystemHealthCheck"("status");
