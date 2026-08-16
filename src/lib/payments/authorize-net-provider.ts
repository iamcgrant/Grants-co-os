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
import { requireAuthorizeNetSandboxConfig } from "./authorize-net-config";
import {
  buildCreateTransactionRequest,
  parseAcceptJsOpaqueData,
  parseCreateTransactionResponse,
  postAuthorizeNetSandbox,
  type AuthorizeNetHttp,
} from "./authorize-net-api";

/**
 * Authorize.Net adapter — preferred primary for proprietary Grants Pay checkout.
 *
 * Uses Accept.js opaqueData tokens (never raw PAN/CVV on our servers).
 * Sandbox createTransactionRequest is wired. Fail-closed without sandbox credentials.
 * Live charges remain DISABLED until PAYMENT_PROVIDER=authorize_net AND
 * AUTHORIZE_NET_LIVE_CHARGES=true are both set after explicit approval.
 *
 * Credentials (server env only — never commit / never expose to browser except public client key):
 * - AUTHORIZE_NET_SANDBOX_API_LOGIN_ID (alias: AUTHORIZE_NET_API_LOGIN_ID)
 * - AUTHORIZE_NET_SANDBOX_TRANSACTION_KEY (alias: AUTHORIZE_NET_TRANSACTION_KEY)
 * - AUTHORIZE_NET_SANDBOX_CLIENT_KEY (alias: AUTHORIZE_NET_PUBLIC_CLIENT_KEY; browser Accept.js only)
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

  constructor(private readonly http: AuthorizeNetHttp = fetch) {}

  private requireSandbox() {
    return requireAuthorizeNetSandboxConfig();
  }

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    this.requireSandbox();
    // Bookkeeping handle only — CIM createCustomerProfileRequest is not claimed.
    return { providerCustomerId: `anet_cus_${input.clientId}` };
  }

  async createCheckoutSession(input: {
    amountCents: number;
    currency?: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<{ sessionId: string; url: string }> {
    this.requireSandbox();
    void input;
    throw new Error(
      "Authorize.Net Accept Hosted checkout is not this path. Use Accept.js opaqueData on /pay/[invoice].",
    );
  }

  async tokenizePaymentMethod(
    input: TokenizePaymentMethodInput,
  ): Promise<TokenizePaymentMethodResult> {
    this.requireSandbox();
    const opaque = parseAcceptJsOpaqueData(input.paymentToken);
    const handle = opaque.dataValue.replace(/[^A-Za-z0-9]/g, "").slice(-12) || "opaque";
    return {
      providerPaymentMethodId: `anet_pm_${handle}`,
      type: input.type || "card",
    };
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const config = this.requireSandbox();
    if (!input.paymentToken) {
      throw new Error("Accept.js opaqueData paymentToken is required for Authorize.Net charges.");
    }
    const opaque = parseAcceptJsOpaqueData(input.paymentToken);
    const requestBody = buildCreateTransactionRequest(config, input, opaque);
    const raw = await postAuthorizeNetSandbox(this.http, config, requestBody);
    const result = parseCreateTransactionResponse(raw);
    if (result.status === "SUCCEEDED" && !result.providerTransactionId) {
      return {
        providerTransactionId: "",
        status: "FAILED",
        failureCode: "missing_processor_transaction_id",
        failureMessage: "Processor did not confirm a transaction id.",
      };
    }
    return result;
  }

  async chargePaymentMethod(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return this.createPayment(input);
  }

  async retrievePayment(providerTransactionId: string): Promise<CreatePaymentResult> {
    this.requireSandbox();
    void providerTransactionId;
    throw new Error(
      "Authorize.Net retrievePayment is not wired. Confirm charges from createTransactionRequest only.",
    );
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    this.requireSandbox();
    void input;
    throw new Error(
      "Authorize.Net refunds are not wired. Refund status is not invented.",
    );
  }

  async retrieveRefund(providerRefundId: string): Promise<RefundPaymentResult> {
    this.requireSandbox();
    void providerRefundId;
    throw new Error("Authorize.Net retrieveRefund is not wired. Refund status is not invented.");
  }

  async retrieveSettlementStatus(
    providerTransactionId: string,
  ): Promise<"UNSETTLED" | "PENDING" | "SETTLED" | "FAILED"> {
    this.requireSandbox();
    void providerTransactionId;
    // Auth/capture confirmation ≠ settlement. Do not invent SETTLED/payout.
    return "UNSETTLED";
  }

  async verifyWebhook(input: WebhookVerificationInput): Promise<boolean> {
    const signatureKey = process.env.AUTHORIZE_NET_SIGNATURE_KEY;
    if (!signatureKey) return false;
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
