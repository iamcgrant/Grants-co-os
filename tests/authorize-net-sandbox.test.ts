import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AUTHORIZE_NET_PRODUCTION_ENDPOINT,
  AUTHORIZE_NET_SANDBOX_ACCEPT_JS,
  AUTHORIZE_NET_SANDBOX_API_LOGIN_ID_ENV,
  AUTHORIZE_NET_SANDBOX_CLIENT_KEY_ENV,
  AUTHORIZE_NET_SANDBOX_ENDPOINT,
  AUTHORIZE_NET_SANDBOX_TRANSACTION_KEY_ENV,
  LIVE_CHARGES_LOCKED_MESSAGE,
  SANDBOX_NOT_CONFIGURED_MESSAGE,
  authorizeNetCredentialStatus,
  getAuthorizeNetPublicCheckoutConfig,
  getAuthorizeNetSandboxConfig,
  isAuthorizeNetLiveChargesEnabled,
  isAuthorizeNetSandboxReady,
  isCommasLiveChargesEnabled,
  requireAuthorizeNetSandboxConfig,
} from "../src/lib/payments/authorize-net-config";
import {
  assertSandboxEndpoint,
  buildCreateTransactionRequest,
  parseAcceptJsOpaqueData,
  parseCreateTransactionResponse,
} from "../src/lib/payments/authorize-net-api";
import { AuthorizeNetPaymentProvider } from "../src/lib/payments/authorize-net-provider";
import { resetPaymentProviderCache } from "../src/lib/payments/provider";

const ENV_KEYS = [
  "PAYMENT_PROVIDER",
  "AUTHORIZE_NET_ENVIRONMENT",
  "AUTHORIZE_NET_LIVE_CHARGES",
  "COMMAS_LIVE_CHARGES",
  AUTHORIZE_NET_SANDBOX_API_LOGIN_ID_ENV,
  AUTHORIZE_NET_SANDBOX_TRANSACTION_KEY_ENV,
  AUTHORIZE_NET_SANDBOX_CLIENT_KEY_ENV,
  "AUTHORIZE_NET_API_LOGIN_ID",
  "AUTHORIZE_NET_TRANSACTION_KEY",
  "AUTHORIZE_NET_PUBLIC_CLIENT_KEY",
] as const;

const FAKE_LOGIN = "sandbox-login-test";
const FAKE_TXN_KEY = "sandbox-txn-key-test";
const FAKE_CLIENT_KEY = "sandbox-client-key-test";

const prev: Record<string, string | undefined> = {};

function clearPaymentEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

function setSandboxSecrets() {
  process.env[AUTHORIZE_NET_SANDBOX_API_LOGIN_ID_ENV] = FAKE_LOGIN;
  process.env[AUTHORIZE_NET_SANDBOX_TRANSACTION_KEY_ENV] = FAKE_TXN_KEY;
  process.env[AUTHORIZE_NET_SANDBOX_CLIENT_KEY_ENV] = FAKE_CLIENT_KEY;
  process.env.AUTHORIZE_NET_ENVIRONMENT = "sandbox";
}

function approvedSandboxBody(transId = "12001234567") {
  return JSON.stringify({
    messages: { resultCode: "Ok", message: [{ code: "I00001", text: "Successful." }] },
    transactionResponse: {
      responseCode: "1",
      transId,
      messages: [{ code: "1", description: "This transaction has been approved." }],
    },
  });
}

function declinedSandboxBody(transId = "12007654321") {
  return JSON.stringify({
    messages: { resultCode: "Ok", message: [{ code: "I00001", text: "Successful." }] },
    transactionResponse: {
      responseCode: "2",
      transId,
      errors: [{ errorCode: "2", errorText: "This transaction has been declined." }],
    },
  });
}

describe("Authorize.Net sandbox Accept.js checkout", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      prev[key] = process.env[key];
    }
    clearPaymentEnv();
    resetPaymentProviderCache();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
    resetPaymentProviderCache();
  });

  it("keeps live charge flags locked in this environment", () => {
    expect(process.env.AUTHORIZE_NET_LIVE_CHARGES).not.toBe("true");
    expect(process.env.COMMAS_LIVE_CHARGES).not.toBe("true");
    expect(isAuthorizeNetLiveChargesEnabled()).toBe(false);
    expect(isCommasLiveChargesEnabled()).toBe(false);
  });

  it("fails closed without sandbox credentials and never calls the processor", async () => {
    expect(isAuthorizeNetSandboxReady()).toBe(false);
    expect(getAuthorizeNetSandboxConfig()).toBeNull();
    expect(() => requireAuthorizeNetSandboxConfig()).toThrow(SANDBOX_NOT_CONFIGURED_MESSAGE);

    let httpCalls = 0;
    const provider = new AuthorizeNetPaymentProvider(async () => {
      httpCalls += 1;
      throw new Error("processor must not be called without sandbox credentials");
    });

    await expect(
      provider.createPayment({
        amountCents: 75000,
        providerCustomerId: "anet_cus_test",
        paymentToken: JSON.stringify({
          dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT",
          dataValue: "fake-opaque",
        }),
        idempotencyKey: "fail-closed-1",
      }),
    ).rejects.toThrow(SANDBOX_NOT_CONFIGURED_MESSAGE);
    expect(httpCalls).toBe(0);
  });

  it("locks production charges when AUTHORIZE_NET_LIVE_CHARGES is not true", async () => {
    setSandboxSecrets();
    process.env.AUTHORIZE_NET_ENVIRONMENT = "production";
    expect(isAuthorizeNetSandboxReady()).toBe(false);

    let httpCalls = 0;
    const provider = new AuthorizeNetPaymentProvider(async () => {
      httpCalls += 1;
      throw new Error("production endpoint must not be called");
    });

    await expect(
      provider.createPayment({
        amountCents: 1000,
        providerCustomerId: "anet_cus_test",
        paymentToken: "COMMON.ACCEPT.INAPP.PAYMENT|nonce",
        idempotencyKey: "live-lock-1",
      }),
    ).rejects.toThrow(LIVE_CHARGES_LOCKED_MESSAGE);
    expect(httpCalls).toBe(0);
    expect(isAuthorizeNetLiveChargesEnabled()).toBe(false);
  });

  it("prefers SANDBOX_* secret names and never puts the transaction key in public checkout config", () => {
    process.env.PAYMENT_PROVIDER = "authorize_net";
    process.env.AUTHORIZE_NET_API_LOGIN_ID = "legacy-login";
    process.env.AUTHORIZE_NET_TRANSACTION_KEY = "legacy-txn-key";
    process.env.AUTHORIZE_NET_PUBLIC_CLIENT_KEY = "legacy-client-key";
    setSandboxSecrets();

    const config = requireAuthorizeNetSandboxConfig();
    expect(config.apiLoginId).toBe(FAKE_LOGIN);
    expect(config.transactionKey).toBe(FAKE_TXN_KEY);
    expect(config.endpoint).toBe(AUTHORIZE_NET_SANDBOX_ENDPOINT);

    const publicConfig = getAuthorizeNetPublicCheckoutConfig();
    expect(publicConfig.enabled).toBe(true);
    expect(publicConfig.environment).toBe("sandbox");
    expect(publicConfig.scriptUrl).toBe(AUTHORIZE_NET_SANDBOX_ACCEPT_JS);
    expect(publicConfig.apiLoginId).toBe(FAKE_LOGIN);
    expect(publicConfig.clientKey).toBe(FAKE_CLIENT_KEY);

    const serialized = JSON.stringify({
      checkout: { acceptJs: publicConfig },
      status: authorizeNetCredentialStatus(),
    });
    expect(serialized).not.toContain(FAKE_TXN_KEY);
    expect(serialized).not.toContain("legacy-txn-key");
    expect(serialized).toContain(AUTHORIZE_NET_SANDBOX_API_LOGIN_ID_ENV);
    expect(serialized).toContain(AUTHORIZE_NET_SANDBOX_CLIENT_KEY_ENV);
    expect(serialized).toContain(AUTHORIZE_NET_SANDBOX_TRANSACTION_KEY_ENV);
  });

  it("disables Accept.js public config when the mock provider is active", () => {
    process.env.PAYMENT_PROVIDER = "mock";
    setSandboxSecrets();
    const publicConfig = getAuthorizeNetPublicCheckoutConfig();
    expect(publicConfig.enabled).toBe(false);
    expect(publicConfig.apiLoginId).toBeNull();
    expect(publicConfig.clientKey).toBeNull();
  });

  it("parses Accept.js opaqueData shapes used by the existing paymentToken path", () => {
    expect(
      parseAcceptJsOpaqueData(
        JSON.stringify({
          dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT",
          dataValue: "nonce-json",
        }),
      ),
    ).toEqual({
      dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT",
      dataValue: "nonce-json",
    });
    expect(parseAcceptJsOpaqueData("COMMON.ACCEPT.INAPP.PAYMENT|nonce-pipe")).toEqual({
      dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT",
      dataValue: "nonce-pipe",
    });
    expect(parseAcceptJsOpaqueData("bare-nonce")).toEqual({
      dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT",
      dataValue: "bare-nonce",
    });
  });

  it("records SUCCEEDED only after a confirmed sandbox processor approval", () => {
    const approved = parseCreateTransactionResponse(approvedSandboxBody("998877"));
    expect(approved).toEqual({
      providerTransactionId: "998877",
      status: "SUCCEEDED",
    });

    const declined = parseCreateTransactionResponse(declinedSandboxBody("112233"));
    expect(declined.status).toBe("FAILED");
    expect(declined.providerTransactionId).toBe("112233");
    expect(declined.failureMessage).toMatch(/declined/i);

    const missingId = parseCreateTransactionResponse(
      JSON.stringify({
        messages: { resultCode: "Ok" },
        transactionResponse: { responseCode: "1" },
      }),
    );
    expect(missingId.status).toBe("FAILED");
    expect(missingId.failureCode).toBe("missing_processor_transaction_id");
  });

  it("charges through a mocked sandbox success path and never uses the production endpoint", async () => {
    setSandboxSecrets();
    const seenUrls: string[] = [];
    const provider = new AuthorizeNetPaymentProvider(async (url, init) => {
      seenUrls.push(url);
      expect(url).toBe(AUTHORIZE_NET_SANDBOX_ENDPOINT);
      expect(url).not.toBe(AUTHORIZE_NET_PRODUCTION_ENDPOINT);
      const body = JSON.parse(String(init.body)) as {
        createTransactionRequest: {
          merchantAuthentication: { name: string; transactionKey: string };
          transactionRequest: {
            amount: string;
            payment: { opaqueData: { dataDescriptor: string; dataValue: string } };
          };
        };
      };
      expect(body.createTransactionRequest.transactionRequest.amount).toBe("750.00");
      expect(
        body.createTransactionRequest.transactionRequest.payment.opaqueData.dataDescriptor,
      ).toBe("COMMON.ACCEPT.INAPP.PAYMENT");
      expect(body.createTransactionRequest.merchantAuthentication.name).toBe(FAKE_LOGIN);
      return new Response(approvedSandboxBody("555000111"), { status: 200 });
    });

    const customer = await provider.createCustomer({
      clientId: "client-1",
      email: "payer@test.com",
      name: "Pat Payer",
    });
    const tokenized = await provider.tokenizePaymentMethod({
      providerCustomerId: customer.providerCustomerId,
      paymentToken: JSON.stringify({
        dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT",
        dataValue: "opaque-sandbox-nonce",
      }),
    });
    const charged = await provider.createPayment({
      amountCents: 75000,
      providerCustomerId: customer.providerCustomerId,
      providerPaymentMethodId: tokenized.providerPaymentMethodId,
      paymentToken: JSON.stringify({
        dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT",
        dataValue: "opaque-sandbox-nonce",
      }),
      idempotencyKey: "sandbox-success-1",
      metadata: { invoiceNumber: "GC-2001", grantsClientId: "GC-000100" },
    });

    expect(charged.status).toBe("SUCCEEDED");
    expect(charged.providerTransactionId).toBe("555000111");
    expect(await provider.retrieveSettlementStatus(charged.providerTransactionId)).toBe(
      "UNSETTLED",
    );
    expect(seenUrls).toEqual([AUTHORIZE_NET_SANDBOX_ENDPOINT]);
    await expect(
      provider.refundPayment({
        providerTransactionId: charged.providerTransactionId,
        amountCents: 1000,
        idempotencyKey: "sandbox-refund-1",
      }),
    ).rejects.toThrow(/not invented|not wired/i);
  });

  it("maps a mocked sandbox decline to FAILED without inventing settlement", async () => {
    setSandboxSecrets();
    const provider = new AuthorizeNetPaymentProvider(async (url) => {
      expect(url).toBe(AUTHORIZE_NET_SANDBOX_ENDPOINT);
      return new Response(declinedSandboxBody("555000222"), { status: 200 });
    });

    const declined = await provider.createPayment({
      amountCents: 2500,
      providerCustomerId: "anet_cus_client-1",
      paymentToken: "COMMON.ACCEPT.INAPP.PAYMENT|opaque-decline",
      idempotencyKey: "sandbox-decline-1",
    });
    expect(declined.status).toBe("FAILED");
    expect(declined.providerTransactionId).toBe("555000222");
    expect(declined.failureMessage).toMatch(/declined/i);
    expect(await provider.retrieveSettlementStatus(declined.providerTransactionId)).toBe(
      "UNSETTLED",
    );
  });

  it("refuses the production endpoint helper even if called directly", () => {
    expect(() => assertSandboxEndpoint(AUTHORIZE_NET_PRODUCTION_ENDPOINT)).toThrow(
      /production is locked/i,
    );
    expect(() => assertSandboxEndpoint(AUTHORIZE_NET_SANDBOX_ENDPOINT)).not.toThrow();
  });

  it("builds a sandbox createTransactionRequest with Accept.js opaqueData only", () => {
    setSandboxSecrets();
    const config = requireAuthorizeNetSandboxConfig();
    const request = buildCreateTransactionRequest(
      config,
      {
        amountCents: 1999,
        providerCustomerId: "anet_cus_1",
        paymentToken: "COMMON.ACCEPT.INAPP.PAYMENT|nonce",
        idempotencyKey: "idemp-key-1234567890",
        metadata: { invoiceNumber: "GC-1051" },
      },
      { dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT", dataValue: "nonce" },
    );
    expect(request.createTransactionRequest.transactionRequest.payment).toEqual({
      opaqueData: {
        dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT",
        dataValue: "nonce",
      },
    });
    expect(JSON.stringify(request)).not.toMatch(/\b4[0-9]{12,15}\b/);
  });
});
