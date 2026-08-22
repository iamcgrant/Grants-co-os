/**
 * Cognito Forms official API — fail-closed without COGNITO_API_KEY.
 * Never log or commit the key.
 */

export const COGNITO_API_KEY_ENV = "COGNITO_API_KEY";
export const COGNITO_API_BASE = "https://www.cognitoforms.com/api";
/** Official Cognito Forms Grants home — staff sign-in. No scrape. */
export { COGNITO_OFFICIAL_LOGIN_URL } from "@/lib/nav/official-login-urls";

export function getCognitoApiKey(): string | null {
  return process.env[COGNITO_API_KEY_ENV]?.trim() || null;
}

export function isCognitoConfigured(): boolean {
  return Boolean(getCognitoApiKey());
}

export function cognitoPublicStatus() {
  return {
    configured: isCognitoConfigured(),
    envName: COGNITO_API_KEY_ENV,
    officialApi: true,
    scrape: false as const,
  };
}
