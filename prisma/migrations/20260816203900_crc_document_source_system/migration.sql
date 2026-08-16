-- AlterTable
ALTER TABLE "Document" ADD COLUMN "sourceSystem" TEXT;
ALTER TABLE "Document" ADD COLUMN "originalDate" DATETIME;
ALTER TABLE "Document" ADD COLUMN "sourceClientId" TEXT;
ALTER TABLE "Document" ADD COLUMN "documentType" TEXT;

-- CreateIndex
CREATE INDEX "Document_sourceSystem_idx" ON "Document"("sourceSystem");
