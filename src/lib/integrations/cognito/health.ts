import { latestCognitoPullAt } from "./workspace";
import { isCognitoConfigured } from "./config";

export type CognitoHealthStatus = "CONNECTED" | "DEGRADED" | "ACTION_REQUIRED" | "OFFLINE";

export type CognitoHealthResult = {
  status: CognitoHealthStatus;
  detail: string;
  lastSuccessAt: string | null;
  probed: boolean;
};

/**
 * Honest Cognito health.
 * CONNECTED only after a successful official API pull.
 * COGNITO_API_KEY presence is never CONNECTED.
 */
export async function probeCognitoHealth(): Promise<CognitoHealthResult> {
  const lastPull = await latestCognitoPullAt();
  const lastSuccessAt = lastPull ? lastPull.toISOString() : null;

  if (lastPull) {
    return {
      status: "CONNECTED",
      detail: "Official Cognito Forms API pull recorded · no scrape",
      lastSuccessAt,
      probed: false,
    };
  }

  if (isCognitoConfigured()) {
    return {
      status: "DEGRADED",
      detail: "COGNITO_API_KEY present · no successful official API pull yet. Key presence is never CONNECTED.",
      lastSuccessAt: null,
      probed: false,
    };
  }

  return {
    status: "ACTION_REQUIRED",
    detail: "COGNITO_API_KEY required for official Cognito Forms API (never commit). No scrape.",
    lastSuccessAt: null,
    probed: false,
  };
}
