/**
 * Integration credential accessors.
 * Reads from server env only. Never log secret values.
 */

function requiredHint(name: string): string {
  return `${name} is not set. Add it to server environment / Cursor Secrets (never commit).`;
}

export function getGhlPortalCredentials(): {
  email: string;
  password: string;
} | null {
  const email = process.env.GHL_LOGIN_EMAIL?.trim();
  const password = process.env.GHL_LOGIN_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export function getDisputeFoxPortalCredentials(): {
  email: string;
  password: string;
} | null {
  const email = process.env.DISPUTEFOX_LOGIN_EMAIL?.trim();
  const password = process.env.DISPUTEFOX_LOGIN_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export function getGhlApiConfig(): {
  apiKey: string;
  locationId: string | null;
} | null {
  const apiKey = process.env.GHL_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    locationId: process.env.GHL_LOCATION_ID?.trim() || null,
  };
}

/** Live GHL sync requires both API key and location id. */
export function isGhlLiveConfigured(): boolean {
  const config = getGhlApiConfig();
  return Boolean(config?.apiKey && config.locationId);
}

export function integrationCredentialStatus() {
  const ghlConfig = getGhlApiConfig();
  return {
    ghlPortal: Boolean(getGhlPortalCredentials()),
    ghlApi: Boolean(ghlConfig?.apiKey),
    ghlLocation: Boolean(ghlConfig?.locationId),
    ghlLive: isGhlLiveConfigured(),
    disputeFoxPortal: Boolean(getDisputeFoxPortalCredentials()),
    disputeFoxApi: Boolean(process.env.DISPUTEFOX_API_KEY?.trim()),
    smartCreditSponsor: Boolean(process.env.SMARTCREDIT_SPONSOR_URL?.trim()),
    hints: {
      ghlPortal: getGhlPortalCredentials() ? null : requiredHint("GHL_LOGIN_EMAIL/PASSWORD"),
      ghlApi: ghlConfig?.apiKey ? null : requiredHint("GHL_API_KEY"),
      ghlLocation: ghlConfig?.locationId ? null : requiredHint("GHL_LOCATION_ID"),
      disputeFoxPortal: getDisputeFoxPortalCredentials()
        ? null
        : requiredHint("DISPUTEFOX_LOGIN_EMAIL/PASSWORD"),
    },
  };
}
