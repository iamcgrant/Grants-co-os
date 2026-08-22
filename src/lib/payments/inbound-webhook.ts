/**
 * Official inbound Zapier / GHL webhook → mark a PaymentRequest paid.
 * No scrape. Charles does not need to build the Zap in this change —
 * path and payload are documented in docs/PAYMENTS.md.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { confirmOfficialPayment } from "./service";

export const GRANTS_PAY_INBOUND_PATH = "/api/webhooks/grants-pay";
export const GRANTS_PAY_INBOUND_PROVIDER = "grants_pay";

export type GrantsPayInboundSource = "zapier" | "ghl";

export type GrantsPayInboundPayload = {
  event: "payment.succeeded";
  paymentRequestPublicId?: string;
  invoiceNumber?: string;
  amountCents?: number;
  providerTransactionId?: string;
  source?: GrantsPayInboundSource;
};

export function grantsPayInboundSecretConfigured(): boolean {
  return Boolean(process.env.GRANTS_PAY_INBOUND_WEBHOOK_SECRET?.trim());
}

export function grantsPayInboundContract() {
  return {
    path: GRANTS_PAY_INBOUND_PATH,
    method: "POST",
    auth: "Authorization: Bearer $GRANTS_PAY_INBOUND_WEBHOOK_SECRET  (or x-grants-pay-secret)",
    contentType: "application/json",
    payload: {
      event: "payment.succeeded",
      paymentRequestPublicId: "GP-1001",
      invoiceNumber: "GC-1048",
      amountCents: 75000,
      providerTransactionId: "fanbasis_or_zap_id",
      source: "zapier",
    },
    notes: [
      "Fanbasis has no API Keys page — do not invent COMMAS_API_KEY.",
      "Identify the OS invoice with paymentRequestPublicId and/or invoiceNumber.",
      "source may be zapier or ghl. GHL remains the only phone/SMS/email backend.",
      "Without GRANTS_PAY_INBOUND_WEBHOOK_SECRET the route fails closed.",
    ],
  };
}

export function verifyGrantsPayInboundSecret(headers: Headers): boolean {
  const expected = process.env.GRANTS_PAY_INBOUND_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  const raw =
    headers.get("x-grants-pay-secret") ||
    headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  const provided = raw.trim();
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function inboundSource(value: unknown): GrantsPayInboundSource {
  return value === "ghl" ? "ghl" : "zapier";
}

export async function applyGrantsPayInboundPayment(rawBody: string) {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid JSON payload");
  }

  const event = String(parsed.event || parsed.type || "");
  if (event !== "payment.succeeded") {
    throw new Error("Only event=payment.succeeded is accepted");
  }

  const paymentRequestPublicId =
    typeof parsed.paymentRequestPublicId === "string"
      ? parsed.paymentRequestPublicId.trim()
      : typeof parsed.payment_request_public_id === "string"
        ? parsed.payment_request_public_id.trim()
        : "";
  const invoiceNumber =
    typeof parsed.invoiceNumber === "string"
      ? parsed.invoiceNumber.trim()
      : typeof parsed.invoice_number === "string"
        ? parsed.invoice_number.trim()
        : "";

  if (!paymentRequestPublicId && !invoiceNumber) {
    throw new Error("paymentRequestPublicId or invoiceNumber is required");
  }

  const request = paymentRequestPublicId
    ? await prisma.paymentRequest.findUnique({
        where: { publicId: paymentRequestPublicId },
        include: { invoice: true },
      })
    : await prisma.paymentRequest.findFirst({
        where: { invoice: { invoiceNumber } },
        include: { invoice: true },
        orderBy: { createdAt: "desc" },
      });

  if (!request?.invoice) {
    throw new Error("Payment request or invoice not found");
  }

  const source = inboundSource(parsed.source);
  const providerTransactionId =
    (typeof parsed.providerTransactionId === "string" && parsed.providerTransactionId.trim()) ||
    (typeof parsed.provider_transaction_id === "string" && parsed.provider_transaction_id.trim()) ||
    `inbound:${source}:${request.publicId}:${request.invoice.invoiceNumber}`;

  const providerEventId =
    (typeof parsed.id === "string" && parsed.id.trim()) ||
    createHash("sha256")
      .update(`${source}:${providerTransactionId}:${request.publicId}`)
      .digest("hex")
      .slice(0, 40);

  const existing = await prisma.webhookEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider: GRANTS_PAY_INBOUND_PROVIDER,
        providerEventId,
      },
    },
  });
  if (existing?.status === "PROCESSED") {
    return { duplicate: true as const, event: existing };
  }

  const webhook = existing
    ? existing
    : await prisma.webhookEvent.create({
        data: {
          provider: GRANTS_PAY_INBOUND_PROVIDER,
          providerEventId,
          eventType: "payment.succeeded",
          payloadJson: rawBody,
          status: "RECEIVED",
        },
      });

  const amountCents = Number(parsed.amountCents ?? parsed.amount_cents ?? 0) || null;
  const applied = await confirmOfficialPayment({
    providerName: "commas",
    providerTransactionId,
    amountCents,
    invoiceId: request.invoice.id,
    paymentRequestPublicId: request.publicId,
    providerEventId,
  });

  const processed = await prisma.webhookEvent.update({
    where: { id: webhook.id },
    data: { status: "PROCESSED", processedAt: new Date() },
  });

  return { duplicate: false as const, event: processed, applied, source };
}
