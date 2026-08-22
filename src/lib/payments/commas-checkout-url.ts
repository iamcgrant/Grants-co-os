/**
 * Official Commas (Fanbasis) checkout / product links.
 * Charles confirmed Fanbasis has no API Keys page — do not invent COMMAS_API_KEY.
 * Staff paste or pick a recorded official URL. No scrape.
 */

export const STAFF_RECORDED_COMMAS_SESSION = "staff_recorded";

const EXACT_HOSTS = new Set([
  "fanbasis.com",
  "www.fanbasis.com",
  "qa.dev-fan-basis.com",
  "checkout.fanbasis.com",
  "pay.fanbasis.com",
  "app.fanbasis.com",
]);

export function isOfficialCommasHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (EXACT_HOSTS.has(host)) return true;
  return host.endsWith(".fanbasis.com");
}

export function isOfficialCommasCheckoutUrl(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  try {
    parseOfficialCommasCheckoutUrl(raw);
    return true;
  } catch {
    return false;
  }
}

export function parseOfficialCommasCheckoutUrl(raw: string): string {
  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Official Commas checkout URL is invalid.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Official Commas checkout must be https.");
  }
  if (!isOfficialCommasHost(parsed.hostname)) {
    throw new Error(
      "URL must be an official Fanbasis / Commas checkout or product link. Do not scrape.",
    );
  }
  return parsed.toString();
}

export function commasLastStepUrl(url: string | null | undefined): string | null {
  return isOfficialCommasCheckoutUrl(url) ? parseOfficialCommasCheckoutUrl(url!) : null;
}
