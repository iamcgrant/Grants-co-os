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
  let provider: PaymentProvider;
  switch (name) {
    case "authorize_net":
    case "authorizenet":
    case "authorize.net":
      provider = new AuthorizeNetPaymentProvider();
      break;
    case "commas":
      provider = new CommasPaymentProvider();
      break;
    case "mock":
    default:
      provider = new MockPaymentProvider();
      break;
  }
  cached = provider;
  return provider;
}

export function resetPaymentProviderCache() {
  cached = null;
}

export {
  MockPaymentProvider,
  AuthorizeNetPaymentProvider,
  CommasPaymentProvider,
};
