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

/**
 * Commas (Fanbasis) adapter — Merchant of Record / hosted checkout option.
 *
 * Better as secondary or for MoR / BNPL / subscription payment links.
 * Uses server-side x-api-key only — never expose in browser.
 *
 * Credentials (server env only):
 * - COMMAS_API_KEY
 * - COMMAS_WEBHOOK_SECRET (from webhook subscription create response)
 * - COMMAS_ENVIRONMENT=sandbox|production
 *   sandbox base: https://qa.dev-fan-basis.com
 *   production base: https://www.fanbasis.com
 *
 * Live charges locked until PAYMENT_PROVIDER=commas AND COMMAS_LIVE_CHARGES=true.
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

  private requireConfig(): { apiKey: string; baseUrl: string } {
    const apiKey = process.env.COMMAS_API_KEY;
    const environment =
      (process.env.COMMAS_ENVIRONMENT || "sandbox").toLowerCase() === "production"
        ? "production"
        : "sandbox";

    if (!apiKey) {
      throw new Error(
        "Commas is not configured. Set COMMAS_API_KEY (sandbox key first).",
      );
    }

    if (
      environment === "production" &&
      process.env.COMMAS_LIVE_CHARGES !== "true"
    ) {
      throw new Error(
        "Commas live charges are locked. Set COMMAS_LIVE_CHARGES=true only after explicit production approval.",
      );
    }

    const baseUrl =
      environment === "production"
        ? "https://www.fanbasis.com"
        : "https://qa.dev-fan-basis.com";

    return { apiKey, baseUrl };
  }

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    this.requireConfig();
    void input;
    throw new Error(
      "Commas createCustomer is scaffolded. Provide COMMAS_API_KEY to enable /public-api/customers.",
    );
  }

  async createCheckoutSession(input: {
    amountCents: number;
    currency?: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }) {
    this.requireConfig();
    // POST /public-api/checkout-sessions with success_url → payment_link
    void input;
    throw new Error(
      "Commas checkout-sessions is scaffolded. Provide COMMAS_API_KEY to enable payment_link creation.",
    );
  }

  async tokenizePaymentMethod(
    input: TokenizePaymentMethodInput,
  ): Promise<TokenizePaymentMethodResult> {
    this.requireConfig();
    void input;
    throw new Error(
      "Commas primarily uses hosted payment_link checkout; direct tokenize is not the primary path.",
    );
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    this.requireConfig();
    void input;
    throw new Error(
      "Commas createPayment is scaffolded. Prefer createCheckoutSession + payment.succeeded webhook.",
    );
  }

  async chargePaymentMethod(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return this.createPayment(input);
  }

  async retrievePayment(providerTransactionId: string): Promise<CreatePaymentResult> {
    this.requireConfig();
    void providerTransactionId;
    throw new Error("Commas retrievePayment is scaffolded (GET /public-api/transactions).");
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    this.requireConfig();
    void input;
    throw new Error(
      "Commas refundPayment is scaffolded (POST /public-api/checkout-sessions/transactions/:id/refund).",
    );
  }

  async retrieveRefund(providerRefundId: string): Promise<RefundPaymentResult> {
    this.requireConfig();
    void providerRefundId;
    throw new Error("Commas retrieveRefund is scaffolded.");
  }

  async retrieveSettlementStatus(
    providerTransactionId: string,
  ): Promise<"UNSETTLED" | "PENDING" | "SETTLED" | "FAILED"> {
    this.requireConfig();
    void providerTransactionId;
    // MoR: settlement/payout semantics differ — map carefully when wired
    throw new Error("Commas settlement status mapping is scaffolded.");
  }

  async verifyWebhook(input: WebhookVerificationInput): Promise<boolean> {
    const secret = process.env.COMMAS_WEBHOOK_SECRET;
    if (!secret) return false;
    void input;
    // Verify signature using webhook secret_key from subscription create response
    return false;
  }

  async handleWebhook(rawBody: string): Promise<ParsedWebhookEvent> {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const type = String(payload.type || payload.event_type || "unknown");
    const id = String(payload.id || "");
    const data = (payload.data || payload) as Record<string, unknown>;
    return {
      providerEventId: id || `commas_${Date.now()}`,
      eventType: type,
      providerTransactionId: data.transaction_id
        ? String(data.transaction_id)
        : data.id
          ? String(data.id)
          : undefined,
      status: type === "payment.succeeded" ? "SUCCEEDED" : undefined,
      payload,
    };
  }
}
