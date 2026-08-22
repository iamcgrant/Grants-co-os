/** Official vendor login/home URLs staff open in-OS. No scrape. Do not invent URLs. */

export const OFFICIAL_GHL_LOGIN_URL = "https://app.gohighlevel.com/";
export const OFFICIAL_TELEGRAM_LOGIN_URL = "https://web.telegram.org/a/";
export const OFFICIAL_GMAIL_LOGIN_URL = "https://mail.google.com";
export const GMAIL_WORK_MAILBOX = "cgrant@grantandconsultants.com";

/** Official Cognito Forms Grants home — the page staff sign into. */
export const COGNITO_OFFICIAL_LOGIN_URL = "https://www.cognitoforms.com/grantcoconsultants/home";

/** Official Cloud Tax Office (ProAvalon) home. */
export const OFFICIAL_CLOUD_TAX_OFFICE_URL = "https://grantandco.cloudtaxoffice.com/proavalon/";

/** Official DisputeFox staff login. */
export const OFFICIAL_DISPUTEFOX_LOGIN_URL = "https://pulse.disputeprocess.com/jsp/client/login.jsp";

/** Official Experian Online Dispute Center (consumer). Kept as catalog fallback only. */
export const EXPERIAN_OFFICIAL_CONSUMER_DISPUTE_URL = "https://www.experian.com/disputes/main.html";

/**
 * Experian back-door file-submit portal used by Grants reps.
 * URL from the owner screenshot — not invented.
 */
export const EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL = "https://www.experian.com/consumer/upload/";

/** Experian URL staff get on the Experian desk — back-door submit. */
export function experianOfficialClickUrl(): string {
  const backdoor = EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL.trim();
  if (backdoor.startsWith("https://")) return backdoor;
  return EXPERIAN_OFFICIAL_CONSUMER_DISPUTE_URL;
}
