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
