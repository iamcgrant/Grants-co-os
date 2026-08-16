import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider } from "./provider";
import { addTimelineEvent } from "@/lib/clients/timeline";
import { writeAuditLog } from "@/lib/audit/log";
import type { InvoiceStatus } from "@/generated/prisma/client";

export type ChargeInvoiceInput = {
  invoiceId: string;
  paymentToken: string;
  idempotencyKey: string;
  actorId?: string;
  simulateFailure?: boolean;
};

/**
 * Charge an eligible invoice via the active PaymentProvider.
 * Strict idempotency — duplicate keys return the existing transaction.
 */
export async function chargeInvoice(input: ChargeInvoiceInput) {
  const existing = await prisma.paymentTransaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return { transaction: existing, duplicate: true as const };

  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: { client: true },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (!["DUE", "FAILED", "PROCESSING"].includes(invoice.status)) {
    throw new Error(`Invoice not payable in status ${invoice.status}`);
  }

  const provider = getPaymentProvider();
  const remaining = invoice.amountCents - invoice.amountPaidCents;
  if (remaining <= 0) throw new Error("Invoice already paid");

  let customer = await prisma.paymentCustomer.findFirst({
    where: { clientId: invoice.clientId, provider: provider.name },
  });
  if (!customer) {
    const created = await provider.createCustomer({
      clientId: invoice.clientId,
      email: invoice.client.email,
      name: `${invoice.client.firstName} ${invoice.client.lastName}`,
    });
    customer = await prisma.paymentCustomer.create({
      data: {
        clientId: invoice.clientId,
        provider: provider.name,
        providerCustomerId: created.providerCustomerId,
      },
    });
  }

  const tokenized = await provider.tokenizePaymentMethod({
    providerCustomerId: customer.providerCustomerId,
    paymentToken: input.paymentToken,
  });

  const paymentMethod = await prisma.paymentMethod.create({
    data: {
      clientId: invoice.clientId,
      provider: provider.name,
      providerPaymentMethodId: tokenized.providerPaymentMethodId,
      type: tokenized.type,
      brand: tokenized.brand,
      last4: tokenized.last4,
      expMonth: tokenized.expMonth,
      expYear: tokenized.expYear,
      isDefault: true,
    },
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: "PROCESSING" },
  });

  const result = await provider.createPayment({
    amountCents: remaining,
    providerCustomerId: customer.providerCustomerId,
    providerPaymentMethodId: tokenized.providerPaymentMethodId,
    paymentToken: input.paymentToken,
    idempotencyKey: input.idempotencyKey,
    simulateFailure: input.simulateFailure,
    metadata: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      grantsClientId: invoice.client.grantsClientId,
    },
  });

  const settlementStatus =
    result.status === "SUCCEEDED"
      ? await provider.retrieveSettlementStatus(result.providerTransactionId)
      : "UNSETTLED";

  const transaction = await prisma.$transaction(async (tx) => {
    const txn = await tx.paymentTransaction.create({
      data: {
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        paymentMethodId: paymentMethod.id,
        provider: provider.name,
        providerTransactionId: result.providerTransactionId,
        idempotencyKey: input.idempotencyKey,
        amountCents: remaining,
        status: result.status,
        settlementStatus:
          settlementStatus === "SETTLED"
            ? "SETTLED"
            : settlementStatus === "PENDING"
              ? "PENDING"
              : settlementStatus === "FAILED"
                ? "FAILED"
                : "UNSETTLED",
        failureCode: result.failureCode,
        failureMessage: result.failureMessage,
        settledAt: settlementStatus === "SETTLED" ? new Date() : null,
      },
    });

    await tx.paymentAttempt.create({
      data: {
        transactionId: txn.id,
        attemptNumber: 1,
        status: result.status,
        providerRawId: result.providerTransactionId,
        errorCode: result.failureCode,
        errorMessage: result.failureMessage,
      },
    });

    let newStatus: InvoiceStatus = invoice.status;
    if (result.status === "SUCCEEDED") {
      const amountPaid = invoice.amountPaidCents + remaining;
      newStatus = amountPaid >= invoice.amountCents ? "SUCCEEDED" : "DUE";
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: newStatus,
          amountPaidCents: amountPaid,
          paidAt: newStatus === "SUCCEEDED" ? new Date() : null,
        },
      });
    } else if (result.status === "FAILED") {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "FAILED" },
      });
    }

    return txn;
  });

  if (result.status === "SUCCEEDED") {
    await addTimelineEvent({
      clientId: invoice.clientId,
      actorId: input.actorId,
      eventType: "PAYMENT_RECEIVED",
      title: "Payment Received",
      description: `Payment of $${(remaining / 100).toFixed(2)} for invoice ${invoice.invoiceNumber}`,
      idempotencyKey: `payment:${input.idempotencyKey}`,
      metadata: { transactionId: transaction.id, invoiceId: invoice.id },
    });
  } else if (result.status === "FAILED") {
    await addTimelineEvent({
      clientId: invoice.clientId,
      actorId: input.actorId,
      eventType: "PAYMENT_FAILED",
      title: "Payment Failed",
      description: result.failureMessage || "Payment declined",
      idempotencyKey: `payment_fail:${input.idempotencyKey}`,
    });
  }

  await writeAuditLog({
    actorId: input.actorId,
    action: result.status === "SUCCEEDED" ? "PAYMENT_SUCCEEDED" : "PAYMENT_FAILED",
    entityType: "PaymentTransaction",
    entityId: transaction.id,
    metadata: { invoiceId: invoice.id, amountCents: remaining },
  });

  return { transaction, duplicate: false as const };
}

export async function refundTransaction(input: {
  transactionId: string;
  amountCents?: number;
  reason?: string;
  idempotencyKey: string;
  actorId?: string;
}) {
  const existing = await prisma.refund.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return { refund: existing, duplicate: true as const };

  const txn = await prisma.paymentTransaction.findUnique({
    where: { id: input.transactionId },
    include: { invoice: true, refunds: true },
  });
  if (!txn) throw new Error("Transaction not found");
  if (txn.status !== "SUCCEEDED") throw new Error("Can only refund succeeded payments");

  const alreadyRefunded = txn.refunds.reduce((s, r) => s + r.amountCents, 0);
  const amount = input.amountCents ?? txn.amountCents - alreadyRefunded;
  if (amount <= 0) throw new Error("Nothing left to refund");
  if (amount + alreadyRefunded > txn.amountCents) {
    throw new Error("Refund exceeds transaction amount");
  }

  const provider = getPaymentProvider();
  const result = await provider.refundPayment({
    providerTransactionId: txn.providerTransactionId,
    amountCents: amount,
    idempotencyKey: input.idempotencyKey,
    reason: input.reason,
  });

  const refund = await prisma.$transaction(async (tx) => {
    const created = await tx.refund.create({
      data: {
        clientId: txn.clientId,
        invoiceId: txn.invoiceId,
        transactionId: txn.id,
        provider: provider.name,
        providerRefundId: result.providerRefundId,
        idempotencyKey: input.idempotencyKey,
        amountCents: amount,
        reason: input.reason,
        status: result.status,
      },
    });

    if (txn.invoiceId) {
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: txn.invoiceId },
      });
      const newPaid = Math.max(0, invoice.amountPaidCents - amount);
      const fullyRefunded = newPaid === 0;
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaidCents: newPaid,
          status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
        },
      });
    }

    return created;
  });

  await addTimelineEvent({
    clientId: txn.clientId,
    actorId: input.actorId,
    eventType: "REFUND_CREATED",
    title: "Refund Created",
    description: `Refund of $${(amount / 100).toFixed(2)}`,
    idempotencyKey: `refund:${input.idempotencyKey}`,
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "REFUND_CREATED",
    entityType: "Refund",
    entityId: refund.id,
    metadata: { amountCents: amount, transactionId: txn.id },
  });

  return { refund, duplicate: false as const };
}

/**
 * Process provider webhooks with full idempotency on providerEventId.
 */
export async function processWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>) {
  const provider = getPaymentProvider();
  const valid = await provider.verifyWebhook({ headers, rawBody });
  if (!valid) throw new Error("Invalid webhook signature");

  const event = await provider.handleWebhook(rawBody);

  const existing = await prisma.webhookEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider: provider.name,
        providerEventId: event.providerEventId,
      },
    },
  });
  if (existing?.status === "PROCESSED") {
    return { duplicate: true, event: existing };
  }

  const webhook = existing
    ? existing
    : await prisma.webhookEvent.create({
        data: {
          provider: provider.name,
          providerEventId: event.providerEventId,
          eventType: event.eventType,
          payloadJson: JSON.stringify(event.payload),
          status: "RECEIVED",
        },
      });

  // Mark processed — money mutations must key off provider transaction IDs + uniqueness
  const processed = await prisma.webhookEvent.update({
    where: { id: webhook.id },
    data: { status: "PROCESSED", processedAt: new Date() },
  });

  return { duplicate: false, event: processed, parsed: event };
}
