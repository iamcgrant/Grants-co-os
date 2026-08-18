import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider } from "./provider";
import { nextInvoiceNumber } from "@/lib/clients/identity";
import { addTimelineEvent } from "@/lib/clients/timeline";
import { writeAuditLog } from "@/lib/audit/log";
import { queueAutomation } from "@/lib/automations/engine";
import { commasPublicStatus } from "./commas-config";

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function nextPaymentRequestPublicId() {
  const seq = await prisma.idSequence.upsert({
    where: { name: "payment_request" },
    create: { name: "payment_request", value: 1000 },
    update: { value: { increment: 1 } },
  });
  return `GP-${seq.value}`;
}

export type CreatePaymentRequestInput = {
  clientId: string;
  amountCents: number;
  serviceName?: string;
  description?: string;
  dueAt?: Date | null;
  notes?: string;
  allowPartial?: boolean;
  recurring?: boolean;
  recurringDays?: number;
  invoiceId?: string;
  actorId?: string;
  sendEmail?: boolean;
  sendSms?: boolean;
};

/**
 * Create a payment request + invoice (if needed) + secure payment link.
 * Commas hosted checkout when PAYMENT_PROVIDER=commas and configured;
 * otherwise mock/internal OS pay path for safe local validation.
 * Simulated/mock payments never count as collected production revenue.
 */
export async function createPaymentRequest(input: CreatePaymentRequestInput) {
  if (input.amountCents <= 0) throw new Error("Amount must be positive");

  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) throw new Error("Client not found");

  const provider = getPaymentProvider();
  const publicId = await nextPaymentRequestPublicId();

  let invoiceId = input.invoiceId;
  if (!invoiceId) {
    const invoiceNumber = await nextInvoiceNumber();
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId: client.id,
        status: "DUE",
        amountCents: input.amountCents,
        description: input.description || input.serviceName || "Grants & Co service",
        dueAt: input.dueAt || null,
        items: {
          create: [
            {
              description: input.serviceName || input.description || "Service",
              quantity: 1,
              unitCents: input.amountCents,
              totalCents: input.amountCents,
            },
          ],
        },
      },
    });
    invoiceId = invoice.id;
  }

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
  });

  const request = await prisma.paymentRequest.create({
    data: {
      publicId,
      clientId: client.id,
      invoiceId: invoice.id,
      status: "PENDING",
      amountCents: input.amountCents,
      serviceName: input.serviceName || null,
      description: input.description || invoice.description,
      dueAt: input.dueAt || invoice.dueAt,
      notes: input.notes || null,
      allowPartial: Boolean(input.allowPartial),
      recurring: Boolean(input.recurring),
      recurringDays: input.recurringDays || null,
      provider: provider.name,
      createdByUserId: input.actorId || null,
    },
  });

  const successUrl = `${appBaseUrl()}/pay/continue/${encodeURIComponent(invoice.invoiceNumber)}?source=commas&pr=${encodeURIComponent(publicId)}`;
  const cancelUrl = `${appBaseUrl()}/pay/${encodeURIComponent(invoice.invoiceNumber)}?canceled=1`;
  const osPayPath = `/pay/${invoice.invoiceNumber}`;

  let providerSessionId: string | null = null;
  let providerCheckoutId: string | null = null;
  let externalUrl = `${appBaseUrl()}${osPayPath}`;

  if (provider.createCheckoutSession) {
    try {
      const session = await provider.createCheckoutSession({
        amountCents: input.amountCents,
        successUrl,
        cancelUrl,
        title: input.serviceName || "Grants & Co",
        description: input.description || invoice.description || undefined,
        type: input.recurring ? "subscription" : "onetime_non_reusable",
        frequencyDays: input.recurringDays || undefined,
        metadata: {
          grants_client_id: client.grantsClientId,
          invoice_id: invoice.id,
          invoice_number: invoice.invoiceNumber,
          payment_request_id: request.id,
          payment_request_public_id: publicId,
        },
      });
      providerSessionId = session.sessionId;
      providerCheckoutId = session.checkoutId || null;
      // Prefer Commas payment_link when provider is commas; mock returns success URL.
      if (provider.name === "commas") {
        externalUrl = session.url;
      }
    } catch (err) {
      // Fail soft for mock/local: keep OS pay path. Fail hard for commas if configured.
      if (provider.name === "commas" && commasPublicStatus().configured) {
        throw err;
      }
    }
  }

  const link = await prisma.paymentLink.create({
    data: {
      paymentRequestId: request.id,
      invoiceId: invoice.id,
      clientId: client.id,
      kind: input.recurring ? "RECURRING" : input.allowPartial ? "PARTIAL" : "ONE_TIME",
      provider: provider.name,
      providerSessionId,
      providerCheckoutId,
      url: externalUrl,
      osPayPath,
      status: "ACTIVE",
      expiresAt: input.dueAt || null,
    },
  });

  await addTimelineEvent({
    clientId: client.id,
    actorId: input.actorId,
    eventType: "PAYMENT_REQUEST_CREATED",
    title: "Payment Request Created",
    description: `${publicId} · $${(input.amountCents / 100).toFixed(2)}`,
    idempotencyKey: `payment_request:${request.id}`,
    metadata: { paymentRequestId: request.id, invoiceId: invoice.id },
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "PAYMENT_REQUEST_CREATED",
    entityType: "PaymentRequest",
    entityId: request.id,
    metadata: { amountCents: input.amountCents, invoiceId: invoice.id, provider: provider.name },
  });

  const delivery: { emailQueued: boolean; smsQueued: boolean } = {
    emailQueued: false,
    smsQueued: false,
  };

  if (input.sendEmail) {
    await queueAutomation({
      kind: "PAYMENT_LINK_EMAIL",
      clientId: client.id,
      entityType: "PaymentLink",
      entityId: link.id,
      idempotencyKey: `payment_link_email:${link.id}`,
      payload: {
        to: client.email,
        paymentRequestId: request.id,
        url: link.url,
        osPayPath: link.osPayPath,
      },
    });
    delivery.emailQueued = true;
  }

  if (input.sendSms && client.phone) {
    await queueAutomation({
      kind: "PAYMENT_LINK_SMS",
      clientId: client.id,
      entityType: "PaymentLink",
      entityId: link.id,
      idempotencyKey: `payment_link_sms:${link.id}`,
      payload: {
        to: client.phone,
        paymentRequestId: request.id,
        url: link.url,
      },
    });
    delivery.smsQueued = true;
  }

  if (delivery.emailQueued || delivery.smsQueued) {
    await prisma.paymentRequest.update({
      where: { id: request.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    await prisma.paymentLink.update({
      where: { id: link.id },
      data: {
        lastSentChannel: delivery.emailQueued ? "EMAIL" : "SMS",
        lastSentAt: new Date(),
      },
    });
  }

  return {
    request,
    invoice,
    link: {
      id: link.id,
      url: link.url,
      osPayPath: link.osPayPath,
      provider: link.provider,
      copyUrl: link.url,
    },
    delivery,
    commas: commasPublicStatus(),
  };
}

export async function issueOnboardingToken(input: {
  clientId: string;
  invoiceId?: string | null;
  paymentId?: string | null;
  serviceName?: string | null;
  ttlHours?: number;
}) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: input.clientId } });
  const raw = `gc_ob_${randomBytes(24).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const tokenPrefix = raw.slice(0, 12);
  const expiresAt = new Date(Date.now() + (input.ttlHours ?? 72) * 60 * 60 * 1000);

  await prisma.onboardingToken.create({
    data: {
      tokenHash,
      tokenPrefix,
      clientId: client.id,
      invoiceId: input.invoiceId || null,
      paymentId: input.paymentId || null,
      serviceName: input.serviceName || null,
      email: client.email,
      phone: client.phone,
      expiresAt,
      prefillJson: JSON.stringify({
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        grantsClientId: client.grantsClientId,
      }),
    },
  });

  return {
    token: raw,
    setupPath: `/setup/${raw}`,
    setupUrl: `${appBaseUrl()}/setup/${raw}`,
    expiresAt,
  };
}
