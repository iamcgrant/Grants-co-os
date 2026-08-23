-- LOS launch: document bytes + post-review payment tracking on LoanFile
CREATE TABLE "DocumentBlob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "bytes" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "DocumentBlob_documentId_key" ON "DocumentBlob"("documentId");

ALTER TABLE "LoanFile" ADD COLUMN "paymentRequestPublicId" TEXT;
ALTER TABLE "LoanFile" ADD COLUMN "servicePaymentTransactionId" TEXT;
ALTER TABLE "LoanFile" ADD COLUMN "servicePaymentAmountCents" INTEGER;
ALTER TABLE "LoanFile" ADD COLUMN "servicePaymentAt" DATETIME;
ALTER TABLE "LoanFile" ADD COLUMN "serviceWorkflowUnlocked" BOOLEAN NOT NULL DEFAULT false;
