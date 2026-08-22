/**
 * In-OS portal desks. Sidebar click stays on these OS routes.
 * The desk loads the official vendor login/home — no scrape, no new-tab primary UX.
 */

import { DISPUTE_CHANNELS } from "@/lib/disputes/channels";
import { TAX_DESK_CATALOG } from "@/lib/tax/catalog";
import {
  COGNITO_OFFICIAL_LOGIN_URL,
  EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL,
  OFFICIAL_CLOUD_TAX_OFFICE_URL,
  OFFICIAL_DISPUTEFOX_LOGIN_URL,
  OFFICIAL_GHL_LOGIN_URL,
  OFFICIAL_GMAIL_LOGIN_URL,
  OFFICIAL_TELEGRAM_LOGIN_URL,
  experianOfficialClickUrl,
} from "@/lib/nav/official-login-urls";

export type PortalDeskId =
  | "ghl-inbox"
  | "ghl"
  | "gmail"
  | "ghl-dialer"
  | "telegram"
  | "disputefox"
  | "experian"
  | "equifax"
  | "transunion"
  | "cfpb"
  | "cognito"
  | "cloud-tax-office";

export type PortalEmbedPolicy = "try" | "refused";

export type PortalDeskDef = {
  id: PortalDeskId;
  title: string;
  osHref: string;
  officialUrl: string;
  embed: PortalEmbedPolicy;
};

/**
 * Hosts observed to send X-Frame-Options and/or CSP frame-ancestors that
 * refuse a third-party iframe. Documented so the desk uses the in-OS luxury
 * stage instead of a blank broken-embed icon or a vendor navigation.
 *
 * Investigated 2026-08-22 — no official embed/partner login URL exists for
 * these products. GHL Marketplace Custom Pages embed *your* app inside GHL,
 * not GHL inside OS. Telegram Login Widget is OAuth only, not Telegram Web.
 * Experian upload and Equifax dispute send frame-ancestors none/'self'.
 * vercel.json rewrites is empty; src/proxy.ts only stamps x-gc-pathname.
 * Do not invent a scrape / cookie-forwarding reverse proxy.
 *
 * Cloud Tax Office is not listed: owner production click-test after PR 41
 * showed the ProAvalon login in the desk iframe. Bot fetches may hit a
 * Cloudflare challenge page that sends X-Frame-Options; the staff browser does not.
 */
export const HOSTS_THAT_REFUSE_EMBED = [
  { host: "app.gohighlevel.com", header: "X-Frame-Options: SAMEORIGIN" },
  { host: "www.experian.com", header: "X-Frame-Options: deny; CSP frame-ancestors 'none'" },
  { host: "web.telegram.org", header: "X-Frame-Options: deny" },
  { host: "www.equifax.com", header: "X-Frame-Options: SAMEORIGIN; CSP frame-ancestors 'self'" },
  { host: "www.transunion.com", header: "X-Frame-Options: SAMEORIGIN" },
  { host: "www.consumerfinance.gov", header: "X-Frame-Options: SAMEORIGIN" },
  { host: "mail.google.com", header: "X-Frame-Options: DENY / CSP frame-ancestors 'self'" },
] as const;

/** Honest notes for desks that cannot show the vendor login form in-frame. */
export const PORTAL_EMBED_INVESTIGATION = {
  ghl: "app.gohighlevel.com sends X-Frame-Options: SAMEORIGIN. No official partner login URL.",
  telegram: "web.telegram.org/a and /k send X-Frame-Options: deny. Login Widget is not Telegram Web.",
  experian: "www.experian.com/consumer/upload sends X-Frame-Options: deny and CSP frame-ancestors 'none'.",
  equifax: "www.equifax.com dispute center sends X-Frame-Options: SAMEORIGIN and CSP frame-ancestors 'self'.",
  proxy: "No cookie-safe TOS-safe vendor reverse proxy exists in this repo.",
} as const;

export const PORTAL_DESKS: readonly PortalDeskDef[] = [
  {
    id: "ghl-inbox",
    title: "Inbox",
    osHref: "/inbox",
    officialUrl: OFFICIAL_GHL_LOGIN_URL,
    embed: "refused",
  },
  {
    id: "ghl",
    title: "GHL",
    osHref: "/inbox?tab=ghl",
    officialUrl: OFFICIAL_GHL_LOGIN_URL,
    embed: "refused",
  },
  {
    id: "gmail",
    title: "Gmail",
    osHref: "/inbox?tab=gmail",
    officialUrl: OFFICIAL_GMAIL_LOGIN_URL,
    embed: "refused",
  },
  {
    id: "ghl-dialer",
    title: "Dialer",
    osHref: "/dialer",
    officialUrl: OFFICIAL_GHL_LOGIN_URL,
    embed: "refused",
  },
  {
    id: "telegram",
    title: "Telegram",
    osHref: "/team-chat",
    officialUrl: OFFICIAL_TELEGRAM_LOGIN_URL,
    embed: "refused",
  },
  {
    id: "disputefox",
    title: "DisputeFox",
    osHref: "/credit/disputefox",
    officialUrl: OFFICIAL_DISPUTEFOX_LOGIN_URL,
    embed: "try",
  },
  {
    id: "experian",
    title: "Experian",
    osHref: "/credit/experian",
    officialUrl: EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL,
    embed: "refused",
  },
  {
    id: "equifax",
    title: "Equifax",
    osHref: "/credit/equifax",
    officialUrl: DISPUTE_CHANNELS.EQUIFAX.officialSubmitUrl as string,
    embed: "refused",
  },
  {
    id: "transunion",
    title: "TransUnion",
    osHref: "/credit/transunion",
    officialUrl: DISPUTE_CHANNELS.TRANSUNION.officialSubmitUrl as string,
    embed: "refused",
  },
  {
    id: "cfpb",
    title: "CFPB",
    osHref: "/escalations/cfpb",
    officialUrl: DISPUTE_CHANNELS.CFPB.officialSubmitUrl as string,
    embed: "refused",
  },
  {
    id: "cognito",
    title: "Cognito",
    osHref: "/tax/cognito",
    officialUrl: COGNITO_OFFICIAL_LOGIN_URL,
    embed: "try",
  },
  {
    id: "cloud-tax-office",
    title: "Cloud Tax Office",
    osHref: "/tax/cloud-tax-office",
    officialUrl: OFFICIAL_CLOUD_TAX_OFFICE_URL,
    embed: "try",
  },
];

export function portalDeskById(id: PortalDeskId): PortalDeskDef {
  const desk = PORTAL_DESKS.find((row) => row.id === id);
  if (!desk) throw new Error(`Unknown portal desk: ${id}`);
  return desk;
}

export function hostRefusesEmbed(officialUrl: string): boolean {
  let host = "";
  try {
    host = new URL(officialUrl).hostname;
  } catch {
    return true;
  }
  return HOSTS_THAT_REFUSE_EMBED.some((row) => host === row.host || host.endsWith(`.${row.host}`));
}

export function portalEmbedPolicy(officialUrl: string): PortalEmbedPolicy {
  return hostRefusesEmbed(officialUrl) ? "refused" : "try";
}

/** True only when this desk may load the official login in an iframe. */
export function portalDeskCanEmbed(desk: PortalDeskDef): boolean {
  return desk.embed === "try" && !hostRefusesEmbed(desk.officialUrl);
}

/** Match `/inbox` vs `/inbox?tab=ghl` so each sidebar click has its own desk. */
export function portalLocationKey(location: string): string {
  const trimmed = location.trim();
  const [pathRaw, qs = ""] = trimmed.split("?");
  const path = pathRaw || "/";
  const tab = new URLSearchParams(qs).get("tab");
  if (path === "/inbox" && (tab === "ghl" || tab === "gmail")) return `${path}?tab=${tab}`;
  return path;
}

export function portalDeskForLocation(location: string): PortalDeskDef | null {
  const key = portalLocationKey(location);
  return PORTAL_DESKS.find((row) => row.osHref === key) ?? null;
}

export function isPortalDeskLocation(location: string): boolean {
  return portalDeskForLocation(location) != null;
}

/** Official login/home constants Charles locked. Tests assert these exact strings. */
export const OFFICIAL_PORTAL_URLS = {
  cognito: COGNITO_OFFICIAL_LOGIN_URL,
  cloudTaxOffice: OFFICIAL_CLOUD_TAX_OFFICE_URL,
  disputeFox: OFFICIAL_DISPUTEFOX_LOGIN_URL,
  ghl: OFFICIAL_GHL_LOGIN_URL,
  experianBackdoor: EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL,
  telegram: OFFICIAL_TELEGRAM_LOGIN_URL,
  equifax: DISPUTE_CHANNELS.EQUIFAX.officialSubmitUrl,
  transunion: DISPUTE_CHANNELS.TRANSUNION.officialSubmitUrl,
  cfpb: DISPUTE_CHANNELS.CFPB.officialSubmitUrl,
  experianClick: experianOfficialClickUrl(),
  cloudTaxCatalog: TAX_DESK_CATALOG.CLOUD_TAX_OFFICE.officialLastStepUrl,
} as const;
