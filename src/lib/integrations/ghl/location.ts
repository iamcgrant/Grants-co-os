/**
 * GHL location id is a runtime secret (`GHL_LOCATION_ID`). Never print or commit the value.
 * `GHL_PRODUCTION_LOCATION_ID` is a non-secret placeholder used only when the env var is
 * unset so existing contact-sync tests keep a stable default. Live HTTP still requires
 * `GHL_API_KEY` from host/runtime secrets.
 */

export const GHL_PRODUCTION_LOCATION_ID = "[REDACTED]";

export const GHL_PRODUCTION_LOCATION_URL =
  "https://app.gohighlevel.com/v2/location/[REDACTED]/";

/** Secret / env names already documented in `.env.example`. Never log values. */
export const GHL_API_KEY_ENV = "GHL_API_KEY";
export const GHL_LOCATION_ID_ENV = "GHL_LOCATION_ID";

/** PIT scopes this inbound conversation pull may need. Do not widen scopes from code. */
export const GHL_CONVERSATIONS_READONLY_SCOPE = "conversations.readonly";
export const GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE = "conversations/message.readonly";

/**
 * PIT scopes required for outbound SMS/email via POST /conversations/messages.
 * Confirmed live: current PIT returns 401 "The token is not authorized for this scope."
 * Do not invent wider scopes from application code — X1 adds them on the PIT.
 */
export const GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE = "conversations/message.write";
/** Optional: create/update conversation threads before send when none exists. */
export const GHL_CONVERSATIONS_WRITE_SCOPE = "conversations.write";

export function resolveGhlLocationId(explicit?: string | null): string {
  const fromEnv = explicit?.trim() || process.env[GHL_LOCATION_ID_ENV]?.trim();
  return fromEnv || GHL_PRODUCTION_LOCATION_ID;
}
