/**
 * Commas (Fanbasis) configuration — fail-closed without credentials.
 * Never expose COMMAS_API_KEY or COMMAS_WEBHOOK_SECRET to the browser.
 */

export type CommasEnvironment = "sandbox" | "production";

export type CommasConfig = {
  apiKey: string;
  environment: CommasEnvironment;
  baseUrl: string;
  creatorHandle: string | null;
  liveChargesEnabled: boolean;
};

export function resolveCommasEnvironment(): CommasEnvironment {
  return (process.env.COMMAS_ENVIRONMENT || "sandbox").toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

export function commasBaseUrl(environment: CommasEnvironment = resolveCommasEnvironment()): string {
  return environment === "production"
    ? "https://www.fanbasis.com"
    : "https://qa.dev-fan-basis.com";
}

export function isCommasConfigured(): boolean {
  return Boolean(process.env.COMMAS_API_KEY?.trim());
}

export function getCommasConfig(): CommasConfig {
  const apiKey = process.env.COMMAS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Commas is not configured. Set COMMAS_API_KEY (sandbox key first). Live charges stay locked.",
    );
  }

  const environment = resolveCommasEnvironment();
  const liveChargesEnabled = process.env.COMMAS_LIVE_CHARGES === "true";

  if (environment === "production" && !liveChargesEnabled) {
    throw new Error(
      "Commas live charges are locked. Set COMMAS_LIVE_CHARGES=true only after explicit production approval.",
    );
  }

  return {
    apiKey,
    environment,
    baseUrl: commasBaseUrl(environment),
    creatorHandle: process.env.COMMAS_CREATOR_HANDLE?.trim() || null,
    liveChargesEnabled,
  };
}

export type CommasHealthStatus = "CONNECTED" | "DEGRADED" | "ACTION_REQUIRED" | "OFFLINE";

export function commasPublicStatus(): {
  configured: boolean;
  environment: CommasEnvironment;
  liveChargesEnabled: boolean;
  creatorHandleConfigured: boolean;
} {
  return {
    configured: isCommasConfigured(),
    environment: resolveCommasEnvironment(),
    liveChargesEnabled: process.env.COMMAS_LIVE_CHARGES === "true",
    creatorHandleConfigured: Boolean(process.env.COMMAS_CREATOR_HANDLE?.trim()),
  };
}

/**
 * Honest Commas health. Key presence is never CONNECTED.
 * Fanbasis has no API Keys page — do not invent COMMAS_API_KEY.
 * CONNECTED after a recorded official checkout or a payment-confirming
 * Zapier/GHL (Grants Pay inbound) / Commas webhook — even without a key.
 */
export function commasHonestHealth(input?: {
  lastWebhookAt?: string | null;
  lastCheckoutAt?: string | null;
  paymentProvider?: string;
}): {
  status: CommasHealthStatus;
  detail: string;
  lastSuccessAt: string | null;
  configured: boolean;
  environment: CommasEnvironment;
  liveChargesEnabled: boolean;
} {
  const publicStatus = commasPublicStatus();
  const lastSuccessAt = input?.lastWebhookAt || input?.lastCheckoutAt || null;

  if (!publicStatus.configured) {
    if (lastSuccessAt) {
      return {
        status: "DEGRADED",
        detail: input?.lastWebhookAt
          ? "Payment webhook recorded · Fanbasis has no API Keys page · key absence is never CONNECTED"
          : "Official Commas checkout recorded · Fanbasis has no API Keys page · key absence is never CONNECTED",
        lastSuccessAt,
        ...publicStatus,
      };
    }
    return {
      status: "ACTION_REQUIRED",
      detail:
        "Fanbasis has no API Keys page. Create the OS invoice and attach the official product checkout (Returning Client Restart · $550 · mXrEA). Key absence is never CONNECTED. Zapier cannot mint pay links.",
      lastSuccessAt: null,
      ...publicStatus,
    };
  }

  if (lastSuccessAt) {
    return {
      status: "CONNECTED",
      detail: input?.lastWebhookAt
        ? `Payment webhook processed · env=${publicStatus.environment} · live=${publicStatus.liveChargesEnabled ? "on" : "locked"}`
        : `Official Commas checkout recorded · env=${publicStatus.environment} · live=${publicStatus.liveChargesEnabled ? "on" : "locked"}`,
      lastSuccessAt,
      ...publicStatus,
    };
  }

  if (publicStatus.environment === "production" && !publicStatus.liveChargesEnabled) {
    return {
      status: "DEGRADED",
      detail: "COMMAS_API_KEY present · live charges locked · no successful Commas webhook or checkout yet",
      lastSuccessAt: null,
      ...publicStatus,
    };
  }

  if (input?.paymentProvider && input.paymentProvider !== "commas") {
    return {
      status: "DEGRADED",
      detail: `COMMAS_API_KEY present · PAYMENT_PROVIDER=${input.paymentProvider} · no Commas checkout yet. Key presence is never CONNECTED.`,
      lastSuccessAt: null,
      ...publicStatus,
    };
  }

  return {
    status: "DEGRADED",
    detail: "COMMAS_API_KEY present · no successful Commas webhook or checkout yet. Key presence is never CONNECTED.",
    lastSuccessAt: null,
    ...publicStatus,
  };
}
