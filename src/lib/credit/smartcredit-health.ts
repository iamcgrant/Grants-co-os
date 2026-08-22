import { latestSmartCreditRecordedAt } from "@/lib/credit/smartcredit-workspace";
import { getSmartCreditSponsorConfig } from "@/lib/credit/smartcredit-sponsor";

export type SmartCreditHealthStatus = "CONNECTED" | "DEGRADED" | "ACTION_REQUIRED" | "OFFLINE";

export type SmartCreditHealthResult = {
  status: SmartCreditHealthStatus;
  detail: string;
  lastSuccessAt: string | null;
  probed: boolean;
};

function isoOrNull(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

/**
 * Honest SmartCredit health.
 * CONNECTED only after a live https probe of a supported API URL, or a recorded OS operation.
 * Sponsor URL / API key presence is never CONNECTED.
 */
export async function probeSmartCreditHealth(
  fetchImpl: typeof fetch = fetch,
): Promise<SmartCreditHealthResult> {
  const apiKey = process.env.SMARTCREDIT_API_KEY?.trim() || null;
  const probeUrl = process.env.SMARTCREDIT_API_PROBE_URL?.trim() || null;
  const sponsor = getSmartCreditSponsorConfig();
  const sponsorConfigured = Boolean(sponsor.sponsorUrl || sponsor.sponsorCode);
  const lastRecorded = await latestSmartCreditRecordedAt();
  const lastSuccessAt = isoOrNull(lastRecorded);

  if (probeUrl) {
    const probed = await runSmartCreditProbe(probeUrl, apiKey, fetchImpl);
    if (probed.status === "CONNECTED") return probed;
    if (lastRecorded) {
      return {
        status: "CONNECTED",
        detail: "Recorded SmartCredit workspace operation · live probe did not succeed · no public score API",
        lastSuccessAt,
        probed: true,
      };
    }
    return probed;
  }

  if (lastRecorded) {
    return {
      status: "CONNECTED",
      detail: "Recorded SmartCredit workspace operation · no public score API",
      lastSuccessAt,
      probed: false,
    };
  }

  if (apiKey) {
    return {
      status: "DEGRADED",
      detail:
        "SMARTCREDIT_API_KEY present. No supported read probe URL (SMARTCREDIT_API_PROBE_URL). Key presence is never CONNECTED. No live score sync.",
      lastSuccessAt: null,
      probed: false,
    };
  }

  if (sponsorConfigured) {
    return {
      status: "DEGRADED",
      detail: "Sponsor attribution configured · no live score sync",
      lastSuccessAt: null,
      probed: false,
    };
  }

  return {
    status: "ACTION_REQUIRED",
    detail: "SMARTCREDIT_SPONSOR_URL recommended for affiliate attribution · no live score sync",
    lastSuccessAt: null,
    probed: false,
  };
}

async function runSmartCreditProbe(
  probeUrl: string,
  apiKey: string | null,
  fetchImpl: typeof fetch,
): Promise<SmartCreditHealthResult> {
  let parsed: URL;
  try {
    parsed = new URL(probeUrl);
  } catch {
    return {
      status: "DEGRADED",
      detail: "SMARTCREDIT_API_PROBE_URL is not a valid URL. Not treated as CONNECTED.",
      lastSuccessAt: null,
      probed: false,
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      status: "DEGRADED",
      detail: "SmartCredit probe must be https. Not treated as CONNECTED.",
      lastSuccessAt: null,
      probed: false,
    };
  }

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const response = await fetchImpl(parsed.toString(), { method: "GET", headers });
    if (response.ok) {
      return {
        status: "CONNECTED",
        detail: `Live GET probe ${response.status} · no scrape`,
        lastSuccessAt: new Date().toISOString(),
        probed: true,
      };
    }
    return {
      status: response.status >= 500 ? "OFFLINE" : "DEGRADED",
      detail: `Live GET probe failed (${response.status}). Key presence is never CONNECTED.`,
      lastSuccessAt: null,
      probed: true,
    };
  } catch {
    return {
      status: "OFFLINE",
      detail: "Live GET probe did not complete. Key presence is never CONNECTED.",
      lastSuccessAt: null,
      probed: true,
    };
  }
}
