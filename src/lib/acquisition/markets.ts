/**
 * Charles-locked city/market vocabulary for partner prospecting.
 * PRIMARY is the default start set. SECONDARY is supported in the enum.
 * UNKNOWN / OTHER are allowed explicit stamps. Estill, SC is never a default.
 */

import { AcquisitionError } from "./types";

export const PRIMARY_ACQUISITION_MARKETS = [
  "HILTON_HEAD_ISLAND_SC",
  "BLUFFTON_SC",
  "SAVANNAH_GA",
  "ATLANTA_GA",
  "WASHINGTON_DC",
  "ARLINGTON_VA",
] as const;

export const SECONDARY_ACQUISITION_MARKETS = [
  "CHARLOTTE_NC",
  "COLUMBIA_SC",
  "CHARLESTON_SC",
  "AUGUSTA_GA",
  "ALEXANDRIA_VA",
  "FAIRFAX_VA",
  "RICHMOND_VA",
] as const;

export const ACQUISITION_MARKET_CATCHALLS = ["UNKNOWN", "OTHER"] as const;

export const ACQUISITION_MARKETS = [
  ...PRIMARY_ACQUISITION_MARKETS,
  ...SECONDARY_ACQUISITION_MARKETS,
  ...ACQUISITION_MARKET_CATCHALLS,
] as const;

/** Default prospecting start set — PRIMARY only. Never Estill. */
export const DEFAULT_PROSPECTING_MARKETS = PRIMARY_ACQUISITION_MARKETS;

export type AcquisitionMarketValue = (typeof ACQUISITION_MARKETS)[number];
export type PrimaryAcquisitionMarket = (typeof PRIMARY_ACQUISITION_MARKETS)[number];
export type SecondaryAcquisitionMarket = (typeof SECONDARY_ACQUISITION_MARKETS)[number];

export const ACQUISITION_MARKET_LABELS: Record<AcquisitionMarketValue, string> = {
  HILTON_HEAD_ISLAND_SC: "Hilton Head Island, SC",
  BLUFFTON_SC: "Bluffton, SC",
  SAVANNAH_GA: "Savannah, GA",
  ATLANTA_GA: "Atlanta, GA",
  WASHINGTON_DC: "Washington, DC",
  ARLINGTON_VA: "Arlington, VA",
  CHARLOTTE_NC: "Charlotte, NC",
  COLUMBIA_SC: "Columbia, SC",
  CHARLESTON_SC: "Charleston, SC",
  AUGUSTA_GA: "Augusta, GA",
  ALEXANDRIA_VA: "Alexandria, VA",
  FAIRFAX_VA: "Fairfax, VA",
  RICHMOND_VA: "Richmond, VA",
  UNKNOWN: "Unknown",
  OTHER: "Other",
};

const FORBIDDEN_ESTILL_KEYS = new Set([
  "ESTILL",
  "ESTILL_SC",
  "ESTILL_SOUTH_CAROLINA",
  "ESTILLSC",
]);

const LABEL_TO_MARKET = new Map<string, AcquisitionMarketValue>(
  (Object.entries(ACQUISITION_MARKET_LABELS) as Array<[AcquisitionMarketValue, string]>).flatMap(
    ([key, label]) => [
      [normalizeMarketKey(key), key],
      [normalizeMarketKey(label), key],
    ],
  ),
);

const ALIASES: Record<string, AcquisitionMarketValue> = {
  HILTON_HEAD: "HILTON_HEAD_ISLAND_SC",
  HILTON_HEAD_SC: "HILTON_HEAD_ISLAND_SC",
  HILTON_HEAD_ISLAND: "HILTON_HEAD_ISLAND_SC",
  BLUFFTON: "BLUFFTON_SC",
  SAVANNAH: "SAVANNAH_GA",
  ATLANTA: "ATLANTA_GA",
  WASHINGTON: "WASHINGTON_DC",
  DC: "WASHINGTON_DC",
  ARLINGTON: "ARLINGTON_VA",
  CHARLOTTE: "CHARLOTTE_NC",
  COLUMBIA: "COLUMBIA_SC",
  CHARLESTON: "CHARLESTON_SC",
  AUGUSTA: "AUGUSTA_GA",
  ALEXANDRIA: "ALEXANDRIA_VA",
  FAIRFAX: "FAIRFAX_VA",
  RICHMOND: "RICHMOND_VA",
};

function normalizeMarketKey(raw: string): string {
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/[.,]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function isAcquisitionMarket(value: string): value is AcquisitionMarketValue {
  return (ACQUISITION_MARKETS as readonly string[]).includes(value);
}

export function isForbiddenEstillMarket(raw: string | null | undefined): boolean {
  if (raw == null || String(raw).trim() === "") return false;
  return FORBIDDEN_ESTILL_KEYS.has(normalizeMarketKey(raw));
}

export function marketLabel(market: AcquisitionMarketValue): string {
  return ACQUISITION_MARKET_LABELS[market];
}

/**
 * Fail-closed market parse.
 * Blank/missing → null unless required (then MARKET_REQUIRED).
 * Estill is never accepted and is never a default.
 * UNKNOWN / OTHER are valid only when explicitly stamped.
 */
export function parseAcquisitionMarket(
  raw: string | null | undefined,
  options: { required?: boolean } = {},
): AcquisitionMarketValue | null {
  if (raw == null || String(raw).trim() === "") {
    if (options.required) {
      throw new AcquisitionError(
        "MARKET_REQUIRED",
        "Acquisition market is required and must be a locked city/market. Missing is not Estill and is not a primary default.",
      );
    }
    return null;
  }

  const normalized = normalizeMarketKey(raw);
  if (FORBIDDEN_ESTILL_KEYS.has(normalized)) {
    throw new AcquisitionError(
      "INVALID_MARKET",
      "Estill, SC is not a prospecting market and must never be used as a default.",
    );
  }

  const fromLabel = LABEL_TO_MARKET.get(normalized);
  if (fromLabel) return fromLabel;

  const fromAlias = ALIASES[normalized];
  if (fromAlias) return fromAlias;

  if (isAcquisitionMarket(normalized)) return normalized;

  throw new AcquisitionError(
    "INVALID_MARKET",
    `Market '${raw}' is not in the AcquisitionMarket allow-list. Estill is not a member. Use a locked city, UNKNOWN, or OTHER.`,
  );
}

export function requireAcquisitionMarket(raw: string | null | undefined): AcquisitionMarketValue {
  const market = parseAcquisitionMarket(raw, { required: true });
  if (!market) {
    throw new AcquisitionError(
      "MARKET_REQUIRED",
      "Acquisition market is required and must be a locked city/market.",
    );
  }
  return market;
}
