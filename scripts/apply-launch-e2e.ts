#!/usr/bin/env npx tsx
/**
 * Mortgage apply portal launch E2E — register → disclosures → sections → upload → submit → review.
 * Targets local Prisma by default; optional HTTP probe when APPLY_E2E_BASE_URL is set.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { resetPrismaLosService } from "@/lib/los/prisma-service";
import { readDocumentBytes, storeDocumentBytes } from "@/lib/los/document-storage";
import {
  approveInternalReview,
  confirmMortgageServicePayment,
  createMortgagePaymentRequest,
} from "@/lib/los/review-payment";
import { createClient } from "@/lib/clients/service";
import { hashPassword } from "@/lib/auth/session";
import { Role } from "@/generated/prisma/client";
import { REQUIRED_FOR_SUBMIT } from "@/lib/los/compliance";

const base = (process.env.APPLY_E2E_BASE_URL || "").replace(/\/$/, "");

type Step = { name: string; ok: boolean; detail?: string };
const steps: Step[] = [];

function record(name: string, ok: boolean, detail?: string) {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("=== Mortgage Apply Portal Launch E2E ===\n");

  if (!process.env.MORTGAGE_PII_KEY || process.env.MORTGAGE_PII_KEY.length < 32) {
    process.env.MORTGAGE_PII_KEY = randomBytes(32).toString("base64");
  }

  const suffix = randomBytes(4).toString("hex");
  const email = `borrower-launch-${suffix}@apply-test.grantsandco.com`;
  const password = `LaunchTest-${suffix}!`;
  const passwordHash = await hashPassword(password);

  const owner = await prisma.user.findFirst({ where: { role: Role.OWNER } });
  if (!owner) {
    console.error("ACTION_REQUIRED: seed database (owner user missing)");
    process.exit(2);
  }

  const clientResult = await createClient({
    email,
    firstName: "Launch",
    lastName: "Borrower",
    phone: "5550100999",
    forceCreate: true,
  });
  if (clientResult.status !== "CREATED") {
    record("Create test borrower client", false, clientResult.status);
    process.exit(1);
  }
  const client = clientResult.client;
  record("Create test borrower", true, email);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: "Launch",
      lastName: "Borrower",
      role: Role.CLIENT,
    },
  });

  await prisma.client.update({ where: { id: client.id }, data: { userId: user.id } });

  const los = resetPrismaLosService();
  const created = await los.createApplication({ clientId: client.id });
  const appId = created.applicationId;
  record("Create application + LoanFile", Boolean(appId), created.loanFile.loanNumber);

  await los.acknowledgeCompliance({
    applicationId: appId,
    dpaSelected: true,
    disclosures: REQUIRED_FOR_SUBMIT.map((type) => ({ type, acknowledged: true })),
    signature: { firstName: "Launch", lastName: "Borrower" },
    ip: "127.0.0.1",
    userAgent: "apply-launch-e2e",
  });
  record("Sign disclosures + DPA", true);

  await los.patchSection({
    applicationId: appId,
    section: "BORROWER",
    body: {
      firstNameOnDl: "Launch",
      lastNameOnDl: "Borrower",
      dateOfBirth: "1990-05-15",
      ssn: "123-45-6789",
      mobilePhone: "5550100999",
      email,
    },
  });
  record("Save borrower section", true);

  const doc = await prisma.document.create({
    data: {
      clientId: client.id,
      name: "id.pdf",
      mimeType: "application/pdf",
      storageKey: `los/${appId}/test-id.pdf`,
      category: "MORTGAGE_LOS",
      uploadedById: user.id,
    },
  });
  const bytes = Buffer.from("launch-e2e-pdf-bytes");
  await storeDocumentBytes({ documentId: doc.id, bytes, storageKey: doc.storageKey });
  await prisma.mortgageDocumentFile.create({
    data: {
      applicationId: appId,
      documentId: doc.id,
      package: "IDENTITY",
      kind: "UPLOAD",
      originalName: "id.pdf",
      mimeType: "application/pdf",
      storageKey: doc.storageKey,
      byteSize: bytes.length,
      uploadedByRole: Role.CLIENT,
    },
  });
  const roundtrip = await readDocumentBytes(doc.id, doc.storageKey);
  record(
    "Upload + persist document bytes",
    roundtrip?.toString() === bytes.toString(),
    `${bytes.length} bytes`,
  );

  await los.createQualificationSnapshot({ applicationId: appId });
  const submitted = await los.submitApplication({ applicationId: appId });
  record(
    "Submit application",
    submitted.loanFile.originationStage === "APP_SUBMITTED",
    submitted.loanFile.loanNumber,
  );

  const los2 = resetPrismaLosService();
  const reloaded = await los2.getApplication(appId);
  record(
    "LoanFile survives service restart",
    reloaded.loanFile.originationStage === "APP_SUBMITTED",
    reloaded.loanFile.loanNumber,
  );

  const review = await approveInternalReview({
    applicationId: appId,
    actorUserId: owner.id,
  });
  record(
    "Internal review queue (INITIAL_REVIEW)",
    review.loanFile.originationStage === "INITIAL_REVIEW",
  );

  const payReq = await createMortgagePaymentRequest({
    applicationId: appId,
    actorUserId: owner.id,
  });
  record(
    "Generate payment request (post-review)",
    Boolean(payReq.paymentRequest.publicId),
    payReq.paymentRequest.publicId,
  );

  const paid = await confirmMortgageServicePayment({
    applicationId: appId,
    transactionId: `txn_launch_${suffix}`,
    amountCents: payReq.paymentRequest.amountCents,
    actorUserId: owner.id,
    paymentRequestPublicId: payReq.paymentRequest.publicId,
  });
  record(
    "Payment confirmed + workflow unlocked",
    paid.loanFile.serviceWorkflowUnlocked === true,
    paid.loanFile.originationStage,
  );

  if (base) {
    try {
      const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(10000) });
      const json = (await health.json()) as { ok?: boolean };
      record("HTTP /api/health", health.ok && json.ok === true, base);

      const applyPage = await fetch(`${base}/apply`, { signal: AbortSignal.timeout(10000) });
      record("HTTP /apply page", applyPage.ok, `HTTP ${applyPage.status}`);
    } catch (e) {
      record("HTTP probes", false, e instanceof Error ? e.message : "fetch failed");
    }
  }

  const failed = steps.filter((s) => !s.ok).length;
  console.log(`\n${failed === 0 ? "LAUNCH E2E PASS" : "LAUNCH E2E FAIL"} (${steps.length - failed}/${steps.length})`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
