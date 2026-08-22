/**
 * Official Commas / Fanbasis products Charles confirmed in the dashboard.
 * Settings Checkout does not mint links. Staff copy the product-row link.
 * Zapier cannot create checkout sessions or payment links.
 */

import {
  isOfficialCommasCheckoutUrl,
  parseOfficialCommasCheckoutUrl,
} from "./commas-checkout-url";

export type CommasCatalogProduct = {
  id: string;
  name: string;
  amountCents: number;
  type: "onetime";
};

export const COMMAS_PRODUCTS = [
  {
    id: "mXrEA",
    name: "Returning Client Restart",
    amountCents: 55000,
    type: "onetime",
  },
] as const satisfies readonly CommasCatalogProduct[];

export const DEFAULT_COMMAS_PRODUCT_ID = "mXrEA";

export function defaultCommasProduct(): CommasCatalogProduct {
  return COMMAS_PRODUCTS[0];
}

export function commasProductById(id: string | null | undefined): CommasCatalogProduct | null {
  if (!id) return null;
  return COMMAS_PRODUCTS.find((p) => p.id === id) ?? null;
}

/**
 * Official last-step checkout for a catalog product.
 * Prefer a staff-recorded / env copy-link. Optional creator handle builds the
 * documented Fanbasis agency-checkout URL. Never invent COMMAS_API_KEY.
 */
export function officialProductCheckoutUrl(
  productId: string,
  recordedUrl?: string | null,
): string | null {
  if (recordedUrl && isOfficialCommasCheckoutUrl(recordedUrl)) {
    return parseOfficialCommasCheckoutUrl(recordedUrl);
  }
  if (productId === DEFAULT_COMMAS_PRODUCT_ID) {
    const envUrl = process.env.COMMAS_RETURNING_CLIENT_RESTART_URL?.trim();
    if (envUrl && isOfficialCommasCheckoutUrl(envUrl)) {
      return parseOfficialCommasCheckoutUrl(envUrl);
    }
  }
  const handle = process.env.COMMAS_CREATOR_HANDLE?.trim();
  if (handle && /^[a-zA-Z0-9_-]+$/.test(handle)) {
    return `https://www.fanbasis.com/agency-checkout/${handle}/${encodeURIComponent(productId)}`;
  }
  return null;
}
