-- Backfill migration: inbox, onboarding, dispute rounds, Friday pulse, and agent hub
-- tables were present in schema.prisma but never added to migrate history before
-- 20260816183900_ghl_message_external_id (which ALTERs Message). Timestamp keeps
-- this migration before the GHL migration so shadow DB replay succeeds on fresh clones.

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "subject" TEXT,
    "clientId" TEXT,
    "lastMessageAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'INTERNAL',
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'RECORDED',
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageMention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageMention_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OnboardingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MISSING',
    "completedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OnboardingItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DisputeRound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "preparedAt" DATETIME,
    "sentAt" DATETIME,
    "resultsReceivedAt" DATETIME,
    "nextReviewAt" DATETIME,
    "negativeItemsCount" INTEGER NOT NULL DEFAULT 0,
    "deletedItemsCount" INTEGER NOT NULL DEFAULT 0,
    "remainingItemsCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DisputeRound_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FridayPulseRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekOf" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "triggeredBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "FridayPulseItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "statusUpdate" TEXT NOT NULL,
    "updateStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "scoreRequestStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "scoreResponseStatus" TEXT NOT NULL DEFAULT 'NONE',
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FridayPulseItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FridayPulseRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FridayPulseItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "allowedToolsJson" TEXT NOT NULL,
    "deniedToolsJson" TEXT NOT NULL,
    "permissionsJson" TEXT NOT NULL,
    "maxAutonomyLevel" INTEGER NOT NULL DEFAULT 1,
    "scopesJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "currentTaskId" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" TEXT NOT NULL,
    "durable" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentMemory_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "valueJson" TEXT NOT NULL,
    "sourceAgent" TEXT,
    "durable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idempotencyKey" TEXT,
    "type" TEXT NOT NULL,
    "eventKind" TEXT,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "autonomyLevel" INTEGER NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "ownerAgentId" TEXT,
    "assigneeAgentId" TEXT,
    "parentTaskId" TEXT,
    "resultJson" TEXT,
    "errorMessage" TEXT,
    "cursorAgentId" TEXT,
    "cursorRunId" TEXT,
    "cursorUrl" TEXT,
    "grantsClientId" TEXT,
    "metadataJson" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentTask_ownerAgentId_fkey" FOREIGN KEY ("ownerAgentId") REFERENCES "AgentDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentTask_assigneeAgentId_fkey" FOREIGN KEY ("assigneeAgentId") REFERENCES "AgentDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentTask_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "AgentTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "taskId" TEXT,
    "agentId" TEXT,
    "payloadJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AgentTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT,
    "agentId" TEXT,
    "role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentMessage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AgentTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentMessage_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OwnerApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT,
    "agentId" TEXT,
    "title" TEXT NOT NULL,
    "what" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OwnerApproval_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AgentTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OwnerApproval_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Client" ("createdAt", "duplicateFlag", "email", "emailNormalized", "firstName", "grantsClientId", "id", "lastName", "notes", "phone", "phoneNormalized", "status", "updatedAt", "userId") SELECT "createdAt", "duplicateFlag", "email", "emailNormalized", "firstName", "grantsClientId", "id", "lastName", "notes", "phone", "phoneNormalized", "status", "updatedAt", "userId" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE UNIQUE INDEX "Client_grantsClientId_key" ON "Client"("grantsClientId");
CREATE UNIQUE INDEX "Client_userId_key" ON "Client"("userId");
CREATE INDEX "Client_phoneNormalized_idx" ON "Client"("phoneNormalized");
CREATE INDEX "Client_lastName_firstName_idx" ON "Client"("lastName", "firstName");
CREATE UNIQUE INDEX "Client_emailNormalized_key" ON "Client"("emailNormalized");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Conversation_kind_lastMessageAt_idx" ON "Conversation"("kind", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_clientId_idx" ON "Conversation"("clientId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageMention_messageId_userId_key" ON "MessageMention"("messageId", "userId");

-- CreateIndex
CREATE INDEX "OnboardingItem_clientId_status_idx" ON "OnboardingItem"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingItem_clientId_key_key" ON "OnboardingItem"("clientId", "key");

-- CreateIndex
CREATE INDEX "DisputeRound_clientId_status_idx" ON "DisputeRound"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DisputeRound_clientId_roundNumber_key" ON "DisputeRound"("clientId", "roundNumber");

-- CreateIndex
CREATE INDEX "FridayPulseRun_weekOf_idx" ON "FridayPulseRun"("weekOf");

-- CreateIndex
CREATE INDEX "FridayPulseItem_clientId_idx" ON "FridayPulseItem"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "FridayPulseItem_runId_clientId_key" ON "FridayPulseItem"("runId", "clientId");

-- CreateIndex
CREATE INDEX "AgentMemory_agentId_kind_idx" ON "AgentMemory"("agentId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMemory_agentId_key_key" ON "AgentMemory"("agentId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessFact_key_key" ON "BusinessFact"("key");

-- CreateIndex
CREATE INDEX "BusinessFact_category_idx" ON "BusinessFact"("category");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTask_idempotencyKey_key" ON "AgentTask"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AgentTask_status_idx" ON "AgentTask"("status");

-- CreateIndex
CREATE INDEX "AgentTask_assigneeAgentId_status_idx" ON "AgentTask"("assigneeAgentId", "status");

-- CreateIndex
CREATE INDEX "AgentTask_type_status_idx" ON "AgentTask"("type", "status");

-- CreateIndex
CREATE INDEX "AgentTask_createdAt_idx" ON "AgentTask"("createdAt");

-- CreateIndex
CREATE INDEX "AgentEvent_kind_createdAt_idx" ON "AgentEvent"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "AgentEvent_taskId_idx" ON "AgentEvent"("taskId");

-- CreateIndex
CREATE INDEX "AgentMessage_taskId_createdAt_idx" ON "AgentMessage"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "OwnerApproval_status_createdAt_idx" ON "OwnerApproval"("status", "createdAt");
