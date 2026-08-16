/**
 * Known Grants & Co GoHighLevel location.
 * Public location id (also in the staff URL). Not a secret.
 * Live HTTP still requires GHL_API_KEY from host/runtime secrets.
 */

export const GHL_PRODUCTION_LOCATION_ID = "NsmlbLVNr4SBJNC8gnrn";

export const GHL_PRODUCTION_LOCATION_URL =
  "https://app.gohighlevel.com/v2/location/NsmlbLVNr4SBJNC8gnrn/";

/** Secret / env names already documented in `.env.example`. Never log values. */
export const GHL_API_KEY_ENV = "GHL_API_KEY";
export const GHL_LOCATION_ID_ENV = "GHL_LOCATION_ID";

export function resolveGhlLocationId(explicit?: string | null): string {
  const fromEnv = explicit?.trim() || process.env[GHL_LOCATION_ID_ENV]?.trim();
  return fromEnv || GHL_PRODUCTION_LOCATION_ID;
}
