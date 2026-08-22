/**
 * Official last-step product logins. Sidebar click stays on the in-OS portal
 * route; PortalDesk loads the official https login/home in the desk.
 * No scrape. No new-tab primary UX.
 */

import { DISPUTE_CHANNELS } from "@/lib/disputes/channels";
import { TAX_DESK_CATALOG } from "@/lib/tax/catalog";
import {
  COGNITO_OFFICIAL_LOGIN_URL,
  experianOfficialClickUrl,
  OFFICIAL_GHL_LOGIN_URL,
  OFFICIAL_GMAIL_LOGIN_URL,
  OFFICIAL_TELEGRAM_LOGIN_URL,
} from "@/lib/nav/official-login-urls";

export {
  COGNITO_OFFICIAL_LOGIN_URL,
  EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL,
  EXPERIAN_OFFICIAL_CONSUMER_DISPUTE_URL,
  GMAIL_WORK_MAILBOX,
  OFFICIAL_CLOUD_TAX_OFFICE_URL,
  OFFICIAL_DISPUTEFOX_LOGIN_URL,
  OFFICIAL_GHL_LOGIN_URL,
  OFFICIAL_GMAIL_LOGIN_URL,
  OFFICIAL_TELEGRAM_LOGIN_URL,
  experianOfficialClickUrl,
} from "@/lib/nav/official-login-urls";

export function isLiveNavHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed || trimmed === "#") return false;
  return trimmed.startsWith("/") || trimmed.startsWith("https://");
}

export function isOfficialHttpsHref(href: string): boolean {
  return href.startsWith("https://");
}

export function isInOsNavHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

/** Sidebar <a> always stays inside Grants & Co OS. Official URL loads on the desk. */
export function sidebarClickHref(item: { href: string; officialLastStepUrl?: string }): string {
  return item.href;
}

function catalogLogins(): Record<string, string> {
  const rows: Array<[string, string | null]> = [
    ["/inbox", OFFICIAL_GHL_LOGIN_URL],
    ["/inbox?tab=gmail", OFFICIAL_GMAIL_LOGIN_URL],
    ["/inbox?tab=ghl", OFFICIAL_GHL_LOGIN_URL],
    ["/dialer", OFFICIAL_GHL_LOGIN_URL],
    ["/team-chat", OFFICIAL_TELEGRAM_LOGIN_URL],
    [DISPUTE_CHANNELS.DISPUTEFOX.href, DISPUTE_CHANNELS.DISPUTEFOX.officialSubmitUrl],
    [DISPUTE_CHANNELS.EXPERIAN.href, experianOfficialClickUrl()],
    [DISPUTE_CHANNELS.EQUIFAX.href, DISPUTE_CHANNELS.EQUIFAX.officialSubmitUrl],
    [DISPUTE_CHANNELS.TRANSUNION.href, DISPUTE_CHANNELS.TRANSUNION.officialSubmitUrl],
    [DISPUTE_CHANNELS.INNOVIS.href, DISPUTE_CHANNELS.INNOVIS.officialSubmitUrl],
    [DISPUTE_CHANNELS.SMARTCREDIT.href, DISPUTE_CHANNELS.SMARTCREDIT.officialSubmitUrl],
    [DISPUTE_CHANNELS.CFPB.href, DISPUTE_CHANNELS.CFPB.officialSubmitUrl],
    [TAX_DESK_CATALOG.CLOUD_TAX_OFFICE.href, TAX_DESK_CATALOG.CLOUD_TAX_OFFICE.officialLastStepUrl],
    [TAX_DESK_CATALOG.SBTPG.href, TAX_DESK_CATALOG.SBTPG.officialLastStepUrl],
    ["/tax/cognito", COGNITO_OFFICIAL_LOGIN_URL],
  ];
  return Object.fromEntries(rows.filter((entry): entry is [string, string] => Boolean(entry[1])));
}

export function officialLoginForHref(href: string): string | undefined {
  return catalogLogins()[href];
}
