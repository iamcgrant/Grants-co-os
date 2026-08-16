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
 * Authorize.Net adapter — preferred primary for proprietary Grants Pay checkout.
 *
 * Uses Accept.js opaqueData tokens (never raw PAN/CVV on our servers).
 * Live charges remain DISABLED until PAYMENT_PROVIDER=authorize_net AND
 * AUTHORIZE_NET_LIVE_CHARGES=true are both set after explicit approval.
 *
 * Credentials (server env only — never commit / never expose to browser except public client key):
 * - AUTHORIZE_NET_API_LOGIN_ID
 * - AUTHORIZE_NET_TRANSACTION_KEY
 * - AUTHORIZE_NET_PUBLIC_CLIENT_KEY (browser Accept.js only)
 * - AUTHORIZE_NET_SIGNATURE_KEY (webhook verification)
 * - AUTHORIZE_NET_ENVIRONMENT=sandbox|production
 */
export class AuthorizeNetPaymentProvider implements PaymentProvider {
  readonly name = "authorize_net";
  readonly capabilities: ProviderCapabilities = {
    supports_cards: true,
    supports_ach: true,
    supports_apple_pay: false,
    supports_google_pay: false,
    supports_saved_payment_methods: true,
    supports_recurring: true,
    supports_refunds: true,
    supports_partial_refunds: true,
  };

  private requireConfig(): {
    apiLoginId: string;
    transactionKey: string;
    environment: "sandbox" | "production";
  } {
    const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
    const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;
    const environment =
      (process.env.AUTHORIZE_NET_ENVIRONMENT || "sandbox").toLowerCase() ===
      "production"
        ? "production"
        : "sandbox";

    if (!apiLoginId || !transactionKey) {
      throw new Error(
        "Authorize.Net is not configured. Set AUTHORIZE_NET_API_LOGIN_ID and AUTHORIZE_NET_TRANSACTION_KEY (sandbox first).",
      );
    }

    if (
      environment === "production" &&
      process.env.AUTHORIZE_NET_LIVE_CHARGES !== "true"
    ) {
      throw new Error(
        "Authorize.Net live charges are locked. Set AUTHORIZE_NET_LIVE_CHARGES=true only after explicit production approval.",
      );
    }

    return { apiLoginId, transactionKey, environment };
  }

  private endpoint(environment: "sandbox" | "production") {
    return environment === "production"
      ? "https://api.authorize.net/xml/v1/request.api"
      : "https://apitest.authorize.net/xml/v1/request.api";
  }

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    this.requireConfig();
    // Stub until credentials + approval: CIM createCustomerProfileRequest
    void input;
    throw new Error(
      "Authorize.Net createCustomer is scaffolded. Provide sandbox credentials to enable CIM profiles.",
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
    // Accept Hosted getHostedPaymentPageRequest → form token
    void input;
    throw new Error(
      "Authorize.Net Accept Hosted checkout is scaffolded. Provide sandbox credentials to enable hosted sessions.",
    );
  }

  async tokenizePaymentMethod(
    input: TokenizePaymentMethodInput,
  ): Promise<TokenizePaymentMethodResult> {
    this.requireConfig();
    // Accept.js already tokenized — opaqueData descriptor/value arrive as paymentToken
    void input;
    throw new Error(
      "Authorize.Net tokenizePaymentMethod expects Accept.js opaqueData. Provide sandbox credentials to enable.",
    );
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    this.requireConfig();
    // createTransactionRequest with opaqueData
    void input;
    throw new Error(
      "Authorize.Net createPayment is scaffolded. Live/sandbox charges stay off until credentials + approval.",
    );
  }

  async chargePaymentMethod(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return this.createPayment(input);
  }

  async retrievePayment(providerTransactionId: string): Promise<CreatePaymentResult> {
    this.requireConfig();
    void providerTransactionId;
    throw new Error("Authorize.Net retrievePayment is scaffolded (getTransactionDetailsRequest).");
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    this.requireConfig();
    void input;
    throw new Error("Authorize.Net refundPayment is scaffolded (refundTransaction).");
  }

  async retrieveRefund(providerRefundId: string): Promise<RefundPaymentResult> {
    this.requireConfig();
    void providerRefundId;
    throw new Error("Authorize.Net retrieveRefund is scaffolded.");
  }

  async retrieveSettlementStatus(
    providerTransactionId: string,
  ): Promise<"UNSETTLED" | "PENDING" | "SETTLED" | "FAILED"> {
    this.requireConfig();
    void providerTransactionId;
    throw new Error("Authorize.Net settlement status is scaffolded.");
  }

  async verifyWebhook(input: WebhookVerificationInput): Promise<boolean> {
    const signatureKey = process.env.AUTHORIZE_NET_SIGNATURE_KEY;
    if (!signatureKey) return false;
    // SHA512(signatureKey + rawBody) compared to X-ANET-Signature
    void input;
    return false;
  }

  async handleWebhook(rawBody: string): Promise<ParsedWebhookEvent> {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const eventType = String(payload.eventType || "unknown");
    const notificationId = String(payload.notificationId || payload.id || "");
    const payloadObj = (payload.payload || {}) as Record<string, unknown>;
    return {
      providerEventId: notificationId || `anet_${Date.now()}`,
      eventType,
      providerTransactionId: payloadObj.id ? String(payloadObj.id) : undefined,
      status: payloadObj.responseCode === 1 ? "SUCCEEDED" : undefined,
      payload,
    };
  }
}
