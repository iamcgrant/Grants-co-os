import { prisma } from "@/lib/db/prisma";
import { createPaymentRequest } from "@/lib/payments/payment-requests";
import { LosHttpError } from "./errors";
import { getMortgageServiceBaseCents } from "./document-storage";

export async function approveInternalReview(input: {
  applicationId: string;
  actorUserId: string;
  reason?: string;
}) {
  const app = await prisma.mortgageApplication.findUnique({
    where: { id: input.applicationId },
    include: { loanFile: true },
  });
  if (!app) throw new LosHttpError(404, "APPLICATION_NOT_FOUND");

  const loan = app.loanFile;
  if (!loan) throw new LosHttpError(404, "LOAN_FILE_NOT_FOUND");

  if (loan.originationStage !== "APP_SUBMITTED") {
    throw new LosHttpError(
      422,
      "INVALID_STAGE",
      undefined,
      `Review approve requires APP_SUBMITTED, found ${loan.originationStage}`,
    );
  }

  const now = new Date();

  const updatedLoan = await prisma.loanFile.update({
    where: { id: loan.id },
    data: { originationStage: "INITIAL_REVIEW" },
  });

  await prisma.mortgageApplication.update({
    where: { id: app.id },
    data: {
      pipelineStage: "HUMAN_REVIEW",
      qualitativeStatus: "IN_REVIEW",
    },
  });

  await prisma.loanStageEvent.create({
    data: {
      applicationId: app.id,
      fromStage: "APP_SUBMITTED",
      toStage: "INITIAL_REVIEW",
      actorUserId: input.actorUserId,
      reason: input.reason ?? "Internal review approved",
    },
  });

  await prisma.pipelineEvent.create({
    data: {
      applicationId: app.id,
      fromStage: "APPLICATION_SUBMITTED",
      toStage: "HUMAN_REVIEW",
      actorUserId: input.actorUserId,
      reason: input.reason ?? "Queued for internal review",
    },
  });

  await prisma.losAutomationEvent.create({
    data: {
      applicationId: app.id,
      type: "LOAN_STAGE_CHANGED",
      payloadJson: JSON.stringify({
        from: "APP_SUBMITTED",
        to: "INITIAL_REVIEW",
        actorUserId: input.actorUserId,
      }),
    },
  });

  return { applicationId: app.id, loanFile: updatedLoan };
}

export async function createMortgagePaymentRequest(input: {
  applicationId: string;
  actorUserId: string;
  amountCents?: number;
}) {
  const app = await prisma.mortgageApplication.findUnique({
    where: { id: input.applicationId },
    include: { loanFile: true },
  });
  if (!app) throw new LosHttpError(404, "APPLICATION_NOT_FOUND");

  const loan = app.loanFile;
  if (!loan) throw new LosHttpError(404, "LOAN_FILE_NOT_FOUND");

  if (loan.originationStage !== "INITIAL_REVIEW" && loan.originationStage !== "APP_SUBMITTED") {
    throw new LosHttpError(
      422,
      "INVALID_STAGE",
      undefined,
      "Payment request requires APP_SUBMITTED or INITIAL_REVIEW",
    );
  }

  const base = await getMortgageServiceBaseCents();
  const packageCents =
    loan.servicePackageAmountCents > 0 ? loan.servicePackageAmountCents : base;
  const amountCents = input.amountCents ?? packageCents;

  if (amountCents <= 0) {
    throw new LosHttpError(422, "INVALID_AMOUNT", undefined, "Service package amount is zero");
  }

  const result = await createPaymentRequest({
    clientId: app.clientId,
    amountCents,
    serviceName: "Mortgage Loan Origination Service",
    description: `Mortgage application ${loan.loanNumber}`,
    actorId: input.actorUserId,
    sendEmail: true,
    sendSms: false,
  });

  await prisma.paymentRequest.update({
    where: { id: result.request.id },
    data: {
      metadataJson: JSON.stringify({
        mortgageApplicationId: app.id,
        loanNumber: loan.loanNumber,
        source: "MORTGAGE_LOS",
      }),
    },
  });

  await prisma.loanFile.update({
    where: { id: loan.id },
    data: {
      paymentRequestPublicId: result.request.publicId,
      servicePackageAmountCents: packageCents,
    },
  });

  await prisma.losAutomationEvent.create({
    data: {
      applicationId: app.id,
      type: "PAYMENT_REQUESTED",
      payloadJson: JSON.stringify({
        paymentRequestPublicId: result.request.publicId,
        amountCents,
        loanNumber: loan.loanNumber,
      }),
    },
  });

  return {
    applicationId: app.id,
    paymentRequest: result.request,
    paymentLink: result.link,
    invoice: result.invoice,
  };
}

export async function confirmMortgageServicePayment(input: {
  applicationId: string;
  transactionId: string;
  amountCents: number;
  actorUserId?: string;
  paymentRequestPublicId?: string;
}) {
  const app = await prisma.mortgageApplication.findUnique({
    where: { id: input.applicationId },
    include: { loanFile: true },
  });
  if (!app) throw new LosHttpError(404, "APPLICATION_NOT_FOUND");

  const loan = app.loanFile;
  if (!loan) throw new LosHttpError(404, "LOAN_FILE_NOT_FOUND");

  if (loan.serviceWorkflowUnlocked) {
    return { applicationId: app.id, loanFile: loan, alreadyUnlocked: true };
  }

  const now = new Date();
  const fromStage = loan.originationStage;

  const updatedLoan = await prisma.loanFile.update({
    where: { id: loan.id },
    data: {
      servicePaymentTransactionId: input.transactionId,
      servicePaymentAmountCents: input.amountCents,
      servicePaymentAt: now,
      serviceWorkflowUnlocked: true,
      paymentRequestPublicId: input.paymentRequestPublicId ?? loan.paymentRequestPublicId,
      originationStage:
        fromStage === "INITIAL_REVIEW" || fromStage === "APP_SUBMITTED"
          ? "PROCESSING"
          : loan.originationStage,
    },
  });

  await prisma.mortgageApplication.update({
    where: { id: app.id },
    data: {
      pipelineStage: "MORTGAGE_READY",
      qualitativeStatus: "ON_TRACK",
    },
  });

  if (updatedLoan.originationStage !== fromStage) {
    await prisma.loanStageEvent.create({
      data: {
        applicationId: app.id,
        fromStage,
        toStage: updatedLoan.originationStage,
        actorUserId: input.actorUserId,
        reason: "Service payment confirmed — workflow unlocked",
      },
    });
  }

  await prisma.losAutomationEvent.create({
    data: {
      applicationId: app.id,
      type: "PAYMENT_CONFIRMED",
      payloadJson: JSON.stringify({
        transactionId: input.transactionId,
        amountCents: input.amountCents,
        paymentRequestPublicId: updatedLoan.paymentRequestPublicId,
      }),
    },
  });

  return { applicationId: app.id, loanFile: updatedLoan };
}
