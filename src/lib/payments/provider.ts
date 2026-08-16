import type { PaymentProvider } from "./types";
import { MockPaymentProvider } from "./mock-provider";

/**
 * Ecrypt / NMI stubs — ready for credentials.
 * Do not connect to production until explicitly approved.
 */
export class EcryptPaymentProvider implements PaymentProvider {
  readonly name = "ecrypt";
  readonly capabilities = {
    supports_cards: true,
    supports_ach: true,
    supports_apple_pay: true,
    supports_google_pay: true,
    supports_saved_payment_methods: true,
    supports_recurring: true,
    supports_refunds: true,
    supports_partial_refunds: true,
  };

  private assertConfigured(): never {
    throw new Error(
      "EcryptPaymentProvider is not configured. Provide ECRYPT_API_KEY and ECRYPT_API_SECRET, then enable via PAYMENT_PROVIDER=ecrypt after approval.",
    );
  }

  async createCustomer() {
    return this.assertConfigured();
  }
  async tokenizePaymentMethod() {
    return this.assertConfigured();
  }
  async createPayment() {
    return this.assertConfigured();
  }
  async chargePaymentMethod() {
    return this.assertConfigured();
  }
  async retrievePayment() {
    return this.assertConfigured();
  }
  async refundPayment() {
    return this.assertConfigured();
  }
  async retrieveRefund() {
    return this.assertConfigured();
  }
  async retrieveSettlementStatus() {
    return this.assertConfigured();
  }
  async verifyWebhook() {
    return this.assertConfigured();
  }
  async handleWebhook() {
    return this.assertConfigured();
  }
}

export class NmiPaymentProvider implements PaymentProvider {
  readonly name = "nmi";
  readonly capabilities = {
    supports_cards: true,
    supports_ach: true,
    supports_apple_pay: false,
    supports_google_pay: false,
    supports_saved_payment_methods: true,
    supports_recurring: true,
    supports_refunds: true,
    supports_partial_refunds: true,
  };

  private assertConfigured(): never {
    throw new Error(
      "NmiPaymentProvider is not configured. Provide NMI_SECURITY_KEY after approval.",
    );
  }

  async createCustomer() {
    return this.assertConfigured();
  }
  async tokenizePaymentMethod() {
    return this.assertConfigured();
  }
  async createPayment() {
    return this.assertConfigured();
  }
  async chargePaymentMethod() {
    return this.assertConfigured();
  }
  async retrievePayment() {
    return this.assertConfigured();
  }
  async refundPayment() {
    return this.assertConfigured();
  }
  async retrieveRefund() {
    return this.assertConfigured();
  }
  async retrieveSettlementStatus() {
    return this.assertConfigured();
  }
  async verifyWebhook() {
    return this.assertConfigured();
  }
  async handleWebhook() {
    return this.assertConfigured();
  }
}

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;

  const name = (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
  switch (name) {
    case "ecrypt":
      cached = new EcryptPaymentProvider();
      break;
    case "nmi":
      cached = new NmiPaymentProvider();
      break;
    case "mock":
    default:
      cached = new MockPaymentProvider();
      break;
  }
  return cached;
}

export function resetPaymentProviderCache() {
  cached = null;
}
