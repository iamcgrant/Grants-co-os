import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreateCustomerInput,
  CreateCustomerResult,
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  ProviderCapabilities,
  RefundPaymentInput,
  RefundPaymentResult,
  TokenizePaymentMethodInput,
  TokenizePaymentMethodResult,
  WebhookVerificationInput,
  ParsedWebhookEvent,
} from "./types";
import { getCommasConfig, isCommasConfigured } from "./commas-config";

type CommasApiEnvelope = {
  status?: string;
  message?: string;
  data?: Record<string, unknown>;
  errors?: unknown;
  request_id?: string;
};

/**
 * Commas (Fanbasis) — approved primary payment rail for Grants Pay.
 *
 * Hosted payment_link + webhooks. Grants & Co never receives raw PAN/CVV.
 * Live charges locked until COMMAS_LIVE_CHARGES=true.
 */
export class CommasPaymentProvider implements PaymentProvider {
  readonly name = "commas";
  readonly capabilities: ProviderCapabilities = {
    supports_cards: true,
    supports_ach: false,
    supports_apple_pay: false,
    supports_google_pay: false,
    supports_saved_payment_methods: true,
    supports_recurring: true,
    supports_refunds: true,
    supports_partial_refunds: true,
  };

  private async api<T extends Record<string, unknown> = Record<string, unknown>>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const { apiKey, baseUrl } = getCommasConfig();
    const res = await fetch(`${baseUrl}/public-api${path}`, {
      method,
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await res.json().catch(() => ({}))) as CommasApiEnvelope;
    if (!res.ok || json.status === "error") {
      const detail =
        typeof json.message === "string"
          ? json.message
          : `Commas API ${res.status} on ${path}`;
      throw new Error(detail);
    }
    return (json.data || json) as T;
  }

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    const data = await this.api<{ id?: string | number; customer_id?: string | number }>(
      "POST",
      "/customers",
      {
        email: input.email,
        name: input.name,
        metadata: {
          grants_client_id: input.clientId,
        },
      },
    );
    const providerCustomerId = String(data.id ?? data.customer_id ?? "");
    if (!providerCustomerId) {
      throw new Error("Commas createCustomer did not return a customer id");
    }
    return { providerCustomerId };
  }

  async createCheckoutSession(input: {
    amountCents: number;
    currency?: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
    title?: string;
    description?: string;
    type?: "onetime_non_reusable" | "onetime_reusable" | "subscription";
    frequencyDays?: number;
  }): Promise<{ sessionId: string; url: string; checkoutId?: string }> {
    if (input.amountCents < 100) {
      throw new Error("Commas requires amount_cents >= 100");
    }

    const type = input.type || "onetime_non_reusable";
    const payload: Record<string, unknown> = {
      product: {
        title: input.title || "Grants & Co Service",
        description: input.description || "Secure payment via Grants Pay",
      },
      amount_cents: input.amountCents,
      type,
      success_url: input.successUrl,
      metadata: {
        ...(input.metadata || {}),
        cancel_url: input.cancelUrl,
      },
    };

    if (type === "subscription") {
      payload.subscription = {
        frequency_days: input.frequencyDays || 30,
      };
    }

    const data = await this.api<{
      id?: string;
      checkout_session_id?: string | number;
      payment_link?: string;
    }>("POST", "/checkout-sessions", payload);

    const sessionId = String(data.checkout_session_id ?? data.id ?? "");
    const url = String(data.payment_link ?? "");
    if (!sessionId || !url) {
      throw new Error("Commas checkout-session response missing payment_link");
    }

    return {
      sessionId,
      url,
      checkoutId: data.id ? String(data.id) : undefined,
    };
  }

  async tokenizePaymentMethod(
    _input: TokenizePaymentMethodInput,
  ): Promise<TokenizePaymentMethodResult> {
    throw new Error(
      "Commas uses hosted payment_link checkout. Do not collect card data in Grants & Co OS.",
    );
  }

  async createPayment(_input: CreatePaymentInput): Promise<CreatePaymentResult> {
    throw new Error(
      "Commas charges complete on the hosted payment_link. Use createCheckoutSession + payment.succeeded webhook.",
    );
  }

  async chargePaymentMethod(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return this.createPayment(input);
  }

  async retrievePayment(providerTransactionId: string): Promise<CreatePaymentResult> {
    const data = await this.api<{
      id?: string | number;
      status?: string;
      failure_reason?: string;
    }>("GET", `/transactions/${encodeURIComponent(providerTransactionId)}`);

    const statusRaw = String(data.status || "").toLowerCase();
    let status: CreatePaymentResult["status"] = "PENDING";
    if (["succeeded", "success", "paid", "completed"].includes(statusRaw)) {
      status = "SUCCEEDED";
    } else if (["failed", "declined", "error"].includes(statusRaw)) {
      status = "FAILED";
    } else if (["processing", "pending"].includes(statusRaw)) {
      status = statusRaw === "processing" ? "PROCESSING" : "PENDING";
    }

    return {
      providerTransactionId: String(data.id ?? providerTransactionId),
      status,
      failureMessage: data.failure_reason ? String(data.failure_reason) : undefined,
    };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const data = await this.api<{
      id?: string | number;
      refund_id?: string | number;
      status?: string;
      amount_cents?: number;
    }>(
      "POST",
      `/checkout-sessions/transactions/${encodeURIComponent(input.providerTransactionId)}/refund`,
      {
        amount_cents: input.amountCents,
        reason: input.reason || "requested_by_customer",
        metadata: { idempotency_key: input.idempotencyKey },
      },
    );

    return {
      providerRefundId: String(data.refund_id ?? data.id ?? ""),
      status: String(data.status || "SUCCEEDED"),
      amountCents: Number(data.amount_cents ?? input.amountCents),
    };
  }

  async retrieveRefund(providerRefundId: string): Promise<RefundPaymentResult> {
    return {
      providerRefundId,
      status: "UNKNOWN",
      amountCents: 0,
    };
  }

  async retrieveSettlementStatus(
    _providerTransactionId: string,
  ): Promise<"UNSETTLED" | "PENDING" | "SETTLED" | "FAILED"> {
    // MoR: funds settle on Commas' schedule — treat successful payments as PENDING until payout sync.
    return "PENDING";
  }

  async verifyWebhook(input: WebhookVerificationInput): Promise<boolean> {
    const secret = process.env.COMMAS_WEBHOOK_SECRET?.trim();
    if (!secret) return false;

    const header = input.headers["x-webhook-signature"] || input.headers["X-Webhook-Signature"];
    const signature = Array.isArray(header) ? header[0] : header;
    if (!signature) return false;

    const expected = createHmac("sha256", secret).update(input.rawBody, "utf8").digest("hex");
    try {
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(String(signature).trim(), "hex");
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  async handleWebhook(rawBody: string): Promise<ParsedWebhookEvent> {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;

    // Real deliveries use { id, type, data, created_at }. Test endpoint may be flat.
    const enveloped = Boolean(payload.type && payload.data);
    const type = String(
      enveloped ? payload.type : payload.type || payload.event_type || "unknown",
    );
    const id = String(payload.id || `commas_${Date.now()}`);
    const data = (
      enveloped ? (payload.data as Record<string, unknown>) : payload
    ) as Record<string, unknown>;

    const providerTransactionId = data.transaction_id
      ? String(data.transaction_id)
      : data.id && type.startsWith("payment.")
        ? String(data.id)
        : undefined;

    let status: string | undefined;
    if (type === "payment.succeeded") status = "SUCCEEDED";
    if (type === "payment.failed") status = "FAILED";
    if (type === "payment.refunded" || type === "refund.succeeded") status = "REFUNDED";

    return {
      providerEventId: id,
      eventType: type,
      providerTransactionId,
      status,
      payload,
    };
  }
}

export function commasProviderReady(): boolean {
  return isCommasConfigured();
}
