import { getDisputeFoxApiConfig } from "@/lib/integrations/credentials";
import { DISPUTEFOX_API_KEY_ENV, DISPUTEFOX_ZAP_ENABLED, DISPUTEFOX_ZAP_ID } from "./secrets";

export type DisputeFoxProbeResult = {
  status: "CONNECTED" | "DEGRADED" | "ACTION_REQUIRED" | "OFFLINE";
  detail: string;
  lastSuccessAt: string | null;
  probed: boolean;
};

const DEFAULT_PROBE: DisputeFoxProbeResult = {
  status: "ACTION_REQUIRED",
  detail: `${DISPUTEFOX_API_KEY_ENV} required for a live probe. Key presence alone is never CONNECTED.`,
  lastSuccessAt: null,
  probed: false,
};

/**
 * Real HTTP probe only. Never marks CONNECTED because a key exists.
 * There is no documented public DisputeFox read/list API; Zap 374413762 stays OFF.
 * Optional DISPUTEFOX_API_PROBE_URL must be an https GET the key is allowed to call.
 */
export async function probeDisputeFoxApi(
  fetchImpl: typeof fetch = fetch,
): Promise<DisputeFoxProbeResult> {
  if (DISPUTEFOX_ZAP_ENABLED) {
    return {
      status: "OFFLINE",
      detail: `Zap ${DISPUTEFOX_ZAP_ID} must stay OFF`,
      lastSuccessAt: null,
      probed: false,
    };
  }

  if (!getDisputeFoxApiConfig()?.apiKey) {
    return DEFAULT_PROBE;
  }

  const probeUrl = process.env.DISPUTEFOX_API_PROBE_URL?.trim();
  if (!probeUrl) {
    return {
      status: "DEGRADED",
      detail:
        "API key present. No supported read probe URL (DISPUTEFOX_API_PROBE_URL). Live list stays off. Zap 374413762 stays OFF. Workspace uses OS-attached clients.",
      lastSuccessAt: null,
      probed: false,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(probeUrl);
  } catch {
    return {
      status: "DEGRADED",
      detail: "DISPUTEFOX_API_PROBE_URL is not a valid URL. Not treated as CONNECTED.",
      lastSuccessAt: null,
      probed: false,
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      status: "DEGRADED",
      detail: "DisputeFox probe must be https. Not treated as CONNECTED.",
      lastSuccessAt: null,
      probed: false,
    };
  }

  const config = getDisputeFoxApiConfig();
  if (!config) return DEFAULT_PROBE;

  try {
    const response = await fetchImpl(parsed.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
      },
    });
    if (response.ok) {
      const now = new Date().toISOString();
      return {
        status: "CONNECTED",
        detail: `Live GET probe ${response.status} · Zap ${DISPUTEFOX_ZAP_ID} OFF`,
        lastSuccessAt: now,
        probed: true,
      };
    }
    return {
      status: response.status >= 500 ? "OFFLINE" : "DEGRADED",
      detail: `Live GET probe failed (${response.status}). Key presence is not CONNECTED.`,
      lastSuccessAt: null,
      probed: true,
    };
  } catch {
    return {
      status: "OFFLINE",
      detail: "Live GET probe did not complete. Key presence is not CONNECTED.",
      lastSuccessAt: null,
      probed: true,
    };
  }
}
