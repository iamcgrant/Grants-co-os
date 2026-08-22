/** Official last-step logins that sidebar clicks open in a new tab. No scrape. No iframe. */

export const OFFICIAL_GHL_LOGIN_URL = "https://app.gohighlevel.com/";
export const OFFICIAL_TELEGRAM_LOGIN_URL = "https://web.telegram.org";
export const OFFICIAL_GMAIL_LOGIN_URL = "https://mail.google.com";
export const GMAIL_WORK_MAILBOX = "cgrant@grantandconsultants.com";

/**
 * Official Experian Online Dispute Center from the credit catalog.
 * Used on sidebar click until a documented back-door URL exists in this repo.
 */
export const EXPERIAN_OFFICIAL_CONSUMER_DISPUTE_URL = "https://www.experian.com/disputes/main.html";

/**
 * PLACEHOLDER — Experian back-door file-submit portal used by Grants reps.
 *
 * Searched this repository (credit catalog `officialSubmitUrl`, comments,
 * DisputeFox / Experian workspaces, env examples). No staff back-door URL is
 * present. Do not invent one.
 *
 * Set this to the exact https portal when the owner supplies it. Sidebar click
 * then prefers this over {@link EXPERIAN_OFFICIAL_CONSUMER_DISPUTE_URL}.
 */
export const EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL: string | null = null;

/** Experian URL staff get on click — back-door when supplied, else catalog. */
export function experianOfficialClickUrl(): string {
  const backdoor = EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL?.trim();
  if (backdoor && backdoor.startsWith("https://")) return backdoor;
  return EXPERIAN_OFFICIAL_CONSUMER_DISPUTE_URL;
}
