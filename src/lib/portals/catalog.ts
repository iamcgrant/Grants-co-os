/**
 * Official third-party portal catalog.
 * Staff open these in a new tab (or iframe only when explicitly allowlisted).
 * Never scrape. Never invent vendor APIs.
 */

export const PORTAL_PROVIDER_IDS = [
  "DISPUTEFOX",
  "EXPERIAN",
  "SMARTCREDIT",
  "CREDIT_KARMA",
  "CFPB",
] as const;

export type PortalProviderId = (typeof PORTAL_PROVIDER_IDS)[number];

export type PortalLaunchMode = "NEW_TAB" | "IFRAME";

export type PortalCatalogEntry = {
  id: PortalProviderId;
  label: string;
  href: string;
  officialUrl: string;
  group: "credit" | "escalations";
  iframeAllowed: boolean;
  assistedOnly: boolean;
  description: string;
};

function envIframeAllowed(name: string): boolean {
  return process.env[name] === "true";
}

export function getPortalCatalog(): Record<PortalProviderId, PortalCatalogEntry> {
  const sponsor = process.env.SMARTCREDIT_SPONSOR_URL?.trim();
  return {
    DISPUTEFOX: {
      id: "DISPUTEFOX",
      label: "DisputeFox",
      href: "/credit/disputefox",
      officialUrl: "https://app.disputefox.com/",
      group: "credit",
      iframeAllowed: envIframeAllowed("DISPUTEFOX_IFRAME_ALLOWED"),
      assistedOnly: false,
      description:
        "Dispute workspace. OS tracks rounds locally. Live DisputeFox list stays fail-closed without a key.",
    },
    EXPERIAN: {
      id: "EXPERIAN",
      label: "Experian",
      href: "/credit/experian",
      officialUrl: "https://www.experian.com/login",
      group: "credit",
      iframeAllowed: envIframeAllowed("EXPERIAN_IFRAME_ALLOWED"),
      assistedOnly: true,
      description:
        "Client-assisted Experian portal. No Experian API. Open official login, then record the outcome in OS.",
    },
    SMARTCREDIT: {
      id: "SMARTCREDIT",
      label: "SmartCredit",
      href: "/credit/smartcredit",
      officialUrl: sponsor || "https://www.smartcredit.com/",
      group: "credit",
      iframeAllowed: envIframeAllowed("SMARTCREDIT_IFRAME_ALLOWED"),
      assistedOnly: true,
      description:
        "Sponsored enrollment. Preserve pid / affiliate params. No live SmartCredit score API.",
    },
    CREDIT_KARMA: {
      id: "CREDIT_KARMA",
      label: "Credit Karma",
      href: "/credit/credit-karma",
      officialUrl: "https://www.creditkarma.com/",
      group: "credit",
      iframeAllowed: false,
      assistedOnly: true,
      description:
        "Client-assisted only. Staff never scrape or click offers. Client reads scores; OS stores what they report.",
    },
    CFPB: {
      id: "CFPB",
      label: "CFPB complaint",
      href: "/credit/escalations",
      officialUrl: "https://www.consumerfinance.gov/complaint/",
      group: "escalations",
      iframeAllowed: envIframeAllowed("CFPB_IFRAME_ALLOWED"),
      assistedOnly: true,
      description:
        "Escalations. Official CFPB complaint portal in a new tab. Record complaint id and outcome in OS.",
    },
  };
}

export function getPortalEntry(id: PortalProviderId): PortalCatalogEntry {
  return getPortalCatalog()[id];
}

export function resolveLaunchMode(entry: PortalCatalogEntry): PortalLaunchMode {
  return entry.iframeAllowed ? "IFRAME" : "NEW_TAB";
}

export function isPortalProviderId(value: string): value is PortalProviderId {
  return (PORTAL_PROVIDER_IDS as readonly string[]).includes(value);
}
