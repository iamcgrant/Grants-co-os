/**
 * Authorize.Net sandbox credential resolution.
 *
 * Secret names only belong in docs / .env.example — never commit values.
 * Live charges stay locked unless AUTHORIZE_NET_LIVE_CHARGES=true (do not set).
 */

export const AUTHORIZE_NET_SANDBOX_API_LOGIN_ID_ENV =
  "AUTHORIZE_NET_SANDBOX_API_LOGIN_ID";
export const AUTHORIZE_NET_SANDBOX_TRANSACTION_KEY_ENV =
  "AUTHORIZE_NET_SANDBOX_TRANSACTION_KEY";
export const AUTHORIZE_NET_SANDBOX_CLIENT_KEY_ENV =
  "AUTHORIZE_NET_SANDBOX_CLIENT_KEY";

/** Legacy aliases — sandbox-prefixed names win when both are set. */
const LEGACY_API_LOGIN_ID_ENV = "AUTHORIZE_NET_API_LOGIN_ID";
const LEGACY_TRANSACTION_KEY_ENV = "AUTHORIZE_NET_TRANSACTION_KEY";
const LEGACY_CLIENT_KEY_ENV = "AUTHORIZE_NET_PUBLIC_CLIENT_KEY";

export const AUTHORIZE_NET_SANDBOX_ENDPOINT =
  "https://apitest.authorize.net/xml/v1/request.api";
export const AUTHORIZE_NET_PRODUCTION_ENDPOINT =
  "https://api.authorize.net/xml/v1/request.api";
export const AUTHORIZE_NET_SANDBOX_ACCEPT_JS =
  "https://jstest.authorize.net/v1/Accept.js";
export const AUTHORIZE_NET_PRODUCTION_ACCEPT_JS =
  "https://js.authorize.net/v1/Accept.js";

export const LIVE_CHARGES_LOCKED_MESSAGE =
  "Authorize.Net live charges are locked. Set AUTHORIZE_NET_LIVE_CHARGES=true only after explicit production approval.";

export const SANDBOX_NOT_CONFIGURED_MESSAGE =
  "Authorize.Net sandbox is not configured. Set AUTHORIZE_NET_SANDBOX_API_LOGIN_ID and AUTHORIZE_NET_SANDBOX_TRANSACTION_KEY (or AUTHORIZE_NET_SANDBOX_CLIENT_KEY for Accept.js).";

export type AuthorizeNetEnvironment = "sandbox" | "production";

export type AuthorizeNetSandboxConfig = {
  apiLoginId: string;
  transactionKey: string;
  clientKey: string | null;
  environment: "sandbox";
  endpoint: typeof AUTHORIZE_NET_SANDBOX_ENDPOINT;
};

export type AuthorizeNetPublicCheckoutConfig = {
  enabled: boolean;
  environment: AuthorizeNetEnvironment;
  scriptUrl: string;
  apiLoginId: string | null;
  clientKey: string | null;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  return undefined;
}

export function isAuthorizeNetLiveChargesEnabled(): boolean {
  return process.env.AUTHORIZE_NET_LIVE_CHARGES === "true";
}

export function isCommasLiveChargesEnabled(): boolean {
  return process.env.COMMAS_LIVE_CHARGES === "true";
}

export function resolveAuthorizeNetEnvironment(): AuthorizeNetEnvironment {
  return (process.env.AUTHORIZE_NET_ENVIRONMENT || "sandbox").toLowerCase() ===
    "production"
    ? "production"
    : "sandbox";
}

export function assertAuthorizeNetLiveChargesLocked(): void {
  const environment = resolveAuthorizeNetEnvironment();
  if (environment === "production" && !isAuthorizeNetLiveChargesEnabled()) {
    throw new Error(LIVE_CHARGES_LOCKED_MESSAGE);
  }
}

export function getAuthorizeNetSandboxSecrets(): {
  apiLoginId: string | undefined;
  transactionKey: string | undefined;
  clientKey: string | undefined;
} {
  return {
    apiLoginId: firstEnv(
      AUTHORIZE_NET_SANDBOX_API_LOGIN_ID_ENV,
      LEGACY_API_LOGIN_ID_ENV,
    ),
    transactionKey: firstEnv(
      AUTHORIZE_NET_SANDBOX_TRANSACTION_KEY_ENV,
      LEGACY_TRANSACTION_KEY_ENV,
    ),
    clientKey: firstEnv(
      AUTHORIZE_NET_SANDBOX_CLIENT_KEY_ENV,
      LEGACY_CLIENT_KEY_ENV,
    ),
  };
}

/** Server charge path: login + transaction key. Client key is Accept.js-only. */
export function isAuthorizeNetSandboxReady(): boolean {
  if (resolveAuthorizeNetEnvironment() === "production") return false;
  const { apiLoginId, transactionKey } = getAuthorizeNetSandboxSecrets();
  return Boolean(apiLoginId && transactionKey);
}

export function getAuthorizeNetSandboxConfig(): AuthorizeNetSandboxConfig | null {
  assertAuthorizeNetLiveChargesLocked();
  if (resolveAuthorizeNetEnvironment() !== "sandbox") return null;
  const { apiLoginId, transactionKey, clientKey } = getAuthorizeNetSandboxSecrets();
  if (!apiLoginId || !transactionKey) return null;
  return {
    apiLoginId,
    transactionKey,
    clientKey: clientKey ?? null,
    environment: "sandbox",
    endpoint: AUTHORIZE_NET_SANDBOX_ENDPOINT,
  };
}

export function requireAuthorizeNetSandboxConfig(): AuthorizeNetSandboxConfig {
  assertAuthorizeNetLiveChargesLocked();
  const config = getAuthorizeNetSandboxConfig();
  if (!config) {
    throw new Error(SANDBOX_NOT_CONFIGURED_MESSAGE);
  }
  return config;
}

/**
 * Browser Accept.js fields only. Never includes the transaction key.
 * Enabled only when PAYMENT_PROVIDER is authorize_net and sandbox is ready
 * with a public client key.
 */
export function getAuthorizeNetPublicCheckoutConfig(): AuthorizeNetPublicCheckoutConfig {
  const provider = (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
  const isAuthorizeNet =
    provider === "authorize_net" ||
    provider === "authorizenet" ||
    provider === "authorize.net";
  const environment = resolveAuthorizeNetEnvironment();

  if (
    !isAuthorizeNet ||
    environment !== "sandbox" ||
    isAuthorizeNetLiveChargesEnabled()
  ) {
    return {
      enabled: false,
      environment,
      scriptUrl: AUTHORIZE_NET_SANDBOX_ACCEPT_JS,
      apiLoginId: null,
      clientKey: null,
    };
  }

  const secrets = getAuthorizeNetSandboxSecrets();
  const enabled = Boolean(
    secrets.apiLoginId && secrets.transactionKey && secrets.clientKey,
  );

  return {
    enabled,
    environment: "sandbox",
    scriptUrl: AUTHORIZE_NET_SANDBOX_ACCEPT_JS,
    apiLoginId: enabled ? secrets.apiLoginId! : null,
    clientKey: enabled ? secrets.clientKey! : null,
  };
}

export function authorizeNetCredentialStatus() {
  const sandboxReady = isAuthorizeNetSandboxReady();
  const publicCheckout = getAuthorizeNetPublicCheckoutConfig();
  return {
    sandboxReady,
    acceptJsReady: publicCheckout.enabled,
    liveChargesEnabled: isAuthorizeNetLiveChargesEnabled(),
    commasLiveChargesEnabled: isCommasLiveChargesEnabled(),
    environment: resolveAuthorizeNetEnvironment(),
    envNames: {
      apiLoginId: AUTHORIZE_NET_SANDBOX_API_LOGIN_ID_ENV,
      transactionKey: AUTHORIZE_NET_SANDBOX_TRANSACTION_KEY_ENV,
      clientKey: AUTHORIZE_NET_SANDBOX_CLIENT_KEY_ENV,
    },
  };
}
