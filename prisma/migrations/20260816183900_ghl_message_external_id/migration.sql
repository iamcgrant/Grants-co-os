-- AlterTable
ALTER TABLE "Message" ADD COLUMN "provider" TEXT;
ALTER TABLE "Message" ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Message_provider_externalId_key" ON "Message"("provider", "externalId");
