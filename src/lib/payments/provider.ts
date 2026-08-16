import type { PaymentProvider } from "./types";
import { MockPaymentProvider } from "./mock-provider";
import { AuthorizeNetPaymentProvider } from "./authorize-net-provider";
import { CommasPaymentProvider } from "./commas-provider";

/**
 * Active runtime provider.
 * Default remains `mock` until production activation is explicitly approved.
 * Supported: mock | authorize_net | commas
 */
let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;

  const name = (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
  switch (name) {
    case "authorize_net":
    case "authorizenet":
    case "authorize.net":
      cached = new AuthorizeNetPaymentProvider();
      break;
    case "commas":
      cached = new CommasPaymentProvider();
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

export {
  MockPaymentProvider,
  AuthorizeNetPaymentProvider,
  CommasPaymentProvider,
};
