/**
 * PaymentProvider — interchangeable adapter interface.
 * Never hard-code Grants Pay to a single processor.
 */

export type ProviderCapabilities = {
  supports_cards: boolean;
  supports_ach: boolean;
  supports_apple_pay: boolean;
  supports_google_pay: boolean;
  supports_saved_payment_methods: boolean;
  supports_recurring: boolean;
  supports_refunds: boolean;
  supports_partial_refunds: boolean;
};

export type CreateCustomerInput = {
  clientId: string;
  email: string;
  name: string;
};

export type CreateCustomerResult = {
  providerCustomerId: string;
};

export type TokenizePaymentMethodInput = {
  providerCustomerId: string;
  /** Token from processor-hosted fields — never raw PAN/CVV */
  paymentToken: string;
  type?: "card" | "ach";
};

export type TokenizePaymentMethodResult = {
  providerPaymentMethodId: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  type: string;
};

export type CreatePaymentInput = {
  amountCents: number;
  currency?: string;
  providerCustomerId: string;
  providerPaymentMethodId?: string;
  paymentToken?: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
  /** Simulate failure in mock provider */
  simulateFailure?: boolean;
};

export type CreatePaymentResult = {
  providerTransactionId: string;
  status: "SUCCEEDED" | "FAILED" | "PROCESSING" | "PENDING";
  failureCode?: string;
  failureMessage?: string;
};

export type RefundPaymentInput = {
  providerTransactionId: string;
  amountCents: number;
  idempotencyKey: string;
  reason?: string;
};

export type RefundPaymentResult = {
  providerRefundId: string;
  status: string;
  amountCents: number;
};

export type WebhookVerificationInput = {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
};

export type ParsedWebhookEvent = {
  providerEventId: string;
  eventType: string;
  providerTransactionId?: string;
  status?: string;
  payload: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>;
  createCheckoutSession?(input: {
    amountCents: number;
    currency?: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
    title?: string;
    description?: string;
    type?: "onetime_non_reusable" | "onetime_reusable" | "subscription";
    frequencyDays?: number;
  }): Promise<{ sessionId: string; url: string; checkoutId?: string }>;
  tokenizePaymentMethod(
    input: TokenizePaymentMethodInput,
  ): Promise<TokenizePaymentMethodResult>;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  chargePaymentMethod(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  retrievePayment(providerTransactionId: string): Promise<CreatePaymentResult>;
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
  retrieveRefund(providerRefundId: string): Promise<RefundPaymentResult>;
  retrieveSettlementStatus(
    providerTransactionId: string,
  ): Promise<"UNSETTLED" | "PENDING" | "SETTLED" | "FAILED">;
  retrievePayout?(
    providerPayoutId: string,
  ): Promise<{ status: string; amountCents: number }>;
  verifyWebhook(input: WebhookVerificationInput): Promise<boolean>;
  handleWebhook(rawBody: string): Promise<ParsedWebhookEvent>;
}
