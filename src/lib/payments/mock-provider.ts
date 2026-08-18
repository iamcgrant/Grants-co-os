import { randomUUID } from "node:crypto";
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
 * MockPaymentProvider — safe development/simulator.
 * Never processes real money.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
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

  private payments = new Map<string, CreatePaymentResult & { amountCents: number }>();
  private refunds = new Map<string, RefundPaymentResult>();
  private idempotency = new Map<string, CreatePaymentResult>();

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    return { providerCustomerId: `mock_cus_${input.clientId.slice(0, 8)}` };
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
  }) {
    const sessionId = `mock_cs_${randomUUID().slice(0, 8)}`;
    const invoiceNumber = input.metadata?.invoice_number;
    // Mock stays inside Grants Pay luxury checkout — never invents collected revenue.
    const url = invoiceNumber
      ? `/pay/${encodeURIComponent(invoiceNumber)}?session=${sessionId}`
      : `${input.successUrl}?session=${sessionId}`;
    return {
      sessionId,
      url,
      checkoutId: sessionId,
    };
  }

  async tokenizePaymentMethod(
    input: TokenizePaymentMethodInput,
  ): Promise<TokenizePaymentMethodResult> {
    const last4 = input.paymentToken.replace(/\D/g, "").slice(-4) || "4242";
    return {
      providerPaymentMethodId: `mock_pm_${randomUUID().slice(0, 8)}`,
      brand: "visa",
      last4,
      expMonth: 12,
      expYear: 2030,
      type: input.type || "card",
    };
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const existing = this.idempotency.get(input.idempotencyKey);
    if (existing) return existing;

    if (input.simulateFailure || input.paymentToken === "fail") {
      const result: CreatePaymentResult = {
        providerTransactionId: `mock_txn_fail_${randomUUID().slice(0, 8)}`,
        status: "FAILED",
        failureCode: "card_declined",
        failureMessage: "Simulated decline",
      };
      this.idempotency.set(input.idempotencyKey, result);
      this.payments.set(result.providerTransactionId, {
        ...result,
        amountCents: input.amountCents,
      });
      return result;
    }

    const result: CreatePaymentResult = {
      providerTransactionId: `mock_txn_${randomUUID().slice(0, 8)}`,
      status: "SUCCEEDED",
    };
    this.idempotency.set(input.idempotencyKey, result);
    this.payments.set(result.providerTransactionId, {
      ...result,
      amountCents: input.amountCents,
    });
    return result;
  }

  async chargePaymentMethod(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return this.createPayment(input);
  }

  async retrievePayment(providerTransactionId: string): Promise<CreatePaymentResult> {
    const payment = this.payments.get(providerTransactionId);
    if (!payment) {
      return {
        providerTransactionId,
        status: "FAILED",
        failureMessage: "Not found",
      };
    }
    return payment;
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const existing = [...this.refunds.values()].find(
      (r) => r.providerRefundId.startsWith(`mock_rfnd_${input.idempotencyKey.slice(0, 8)}`),
    );
    if (existing) return existing;

    const payment = this.payments.get(input.providerTransactionId);
    if (!payment || payment.status !== "SUCCEEDED") {
      throw new Error("Cannot refund non-succeeded payment");
    }

    const result: RefundPaymentResult = {
      providerRefundId: `mock_rfnd_${input.idempotencyKey.slice(0, 8)}_${randomUUID().slice(0, 4)}`,
      status: "SUCCEEDED",
      amountCents: input.amountCents,
    };
    this.refunds.set(result.providerRefundId, result);
    return result;
  }

  async retrieveRefund(providerRefundId: string): Promise<RefundPaymentResult> {
    const refund = this.refunds.get(providerRefundId);
    if (!refund) throw new Error("Refund not found");
    return refund;
  }

  async retrieveSettlementStatus(
    providerTransactionId: string,
  ): Promise<"UNSETTLED" | "PENDING" | "SETTLED" | "FAILED"> {
    const payment = this.payments.get(providerTransactionId);
    if (!payment) return "FAILED";
    if (payment.status === "SUCCEEDED") return "SETTLED";
    return "UNSETTLED";
  }

  async verifyWebhook(input: WebhookVerificationInput): Promise<boolean> {
    const sig = input.headers["x-mock-signature"];
    return sig === "mock_valid" || process.env.NODE_ENV !== "production";
  }

  async handleWebhook(rawBody: string): Promise<ParsedWebhookEvent> {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      providerEventId: String(payload.id || randomUUID()),
      eventType: String(payload.type || "payment.succeeded"),
      providerTransactionId: payload.transaction_id
        ? String(payload.transaction_id)
        : undefined,
      status: payload.status ? String(payload.status) : undefined,
      payload,
    };
  }
}
