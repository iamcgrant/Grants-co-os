import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StaffShell } from "@/components/layout/StaffShell";
import { PortalDesk } from "@/components/desk/PortalDesk";
import {
  getDesktopNav,
  getStaffNav,
} from "@/lib/nav/role-nav";
import {
  COGNITO_OFFICIAL_LOGIN_URL,
  EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL,
  OFFICIAL_CLOUD_TAX_OFFICE_URL,
  OFFICIAL_DISPUTEFOX_LOGIN_URL,
  OFFICIAL_GHL_LOGIN_URL,
  OFFICIAL_TELEGRAM_LOGIN_URL,
  experianOfficialClickUrl,
  isInOsNavHref,
  officialLoginForHref,
  sidebarClickHref,
} from "@/lib/nav/official-logins";
import {
  HOSTS_THAT_REFUSE_EMBED,
  OFFICIAL_PORTAL_URLS,
  PORTAL_DESKS,
  hostRefusesEmbed,
  portalDeskById,
  portalDeskForLocation,
} from "@/lib/nav/portal-desks";
import { DISPUTE_CHANNELS } from "@/lib/disputes/channels";
import { TAX_DESK_CATALOG } from "@/lib/tax/catalog";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

vi.mock("next/image", () => ({
  default: (props: { alt?: string }) => createElement("img", { alt: props.alt || "logo" }),
}));

const OWNER = {
  id: "owner-1",
  email: "owner@grantsandco.com",
  firstName: "Charles",
  lastName: "Grant",
  role: "OWNER" as const,
  isActive: true,
  mfaEnabled: false,
};

describe("official portal URL constants", () => {
  it("locks the login/home URLs Charles showed", () => {
    expect(COGNITO_OFFICIAL_LOGIN_URL).toBe("https://www.cognitoforms.com/grantcoconsultants/home");
    expect(OFFICIAL_CLOUD_TAX_OFFICE_URL).toBe("https://grantandco.cloudtaxoffice.com/proavalon/");
    expect(OFFICIAL_DISPUTEFOX_LOGIN_URL).toBe("https://pulse.disputeprocess.com/jsp/client/login.jsp");
    expect(OFFICIAL_GHL_LOGIN_URL).toBe("https://app.gohighlevel.com/");
    expect(EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL).toBe("https://www.experian.com/consumer/upload/");
    expect(OFFICIAL_TELEGRAM_LOGIN_URL).toBe("https://web.telegram.org/a/");
    expect(experianOfficialClickUrl()).toBe("https://www.experian.com/consumer/upload/");
    expect(OFFICIAL_PORTAL_URLS.cognito).toBe(COGNITO_OFFICIAL_LOGIN_URL);
    expect(OFFICIAL_PORTAL_URLS.cloudTaxOffice).toBe(OFFICIAL_CLOUD_TAX_OFFICE_URL);
    expect(OFFICIAL_PORTAL_URLS.disputeFox).toBe(OFFICIAL_DISPUTEFOX_LOGIN_URL);
    expect(OFFICIAL_PORTAL_URLS.ghl).toBe(OFFICIAL_GHL_LOGIN_URL);
    expect(OFFICIAL_PORTAL_URLS.experianBackdoor).toBe(EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL);
    expect(OFFICIAL_PORTAL_URLS.telegram).toBe(OFFICIAL_TELEGRAM_LOGIN_URL);
    expect(OFFICIAL_PORTAL_URLS.equifax).toBe(DISPUTE_CHANNELS.EQUIFAX.officialSubmitUrl);
    expect(OFFICIAL_PORTAL_URLS.transunion).toBe(DISPUTE_CHANNELS.TRANSUNION.officialSubmitUrl);
    expect(OFFICIAL_PORTAL_URLS.cfpb).toBe(DISPUTE_CHANNELS.CFPB.officialSubmitUrl);
    expect(TAX_DESK_CATALOG.CLOUD_TAX_OFFICE.officialLastStepUrl).toBe(OFFICIAL_CLOUD_TAX_OFFICE_URL);
    expect(DISPUTE_CHANNELS.DISPUTEFOX.officialSubmitUrl).toBe(OFFICIAL_DISPUTEFOX_LOGIN_URL);
    expect(DISPUTE_CHANNELS.EXPERIAN.officialSubmitUrl).toBe(EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL);
  });

  it("documents hosts that refuse embed instead of inventing a proxy", () => {
    const hosts = HOSTS_THAT_REFUSE_EMBED.map((row) => row.host);
    expect(hosts).toEqual(
      expect.arrayContaining([
        "app.gohighlevel.com",
        "www.experian.com",
        "web.telegram.org",
        "grantandco.cloudtaxoffice.com",
        "www.equifax.com",
        "www.transunion.com",
        "www.consumerfinance.gov",
      ]),
    );
    expect(hostRefusesEmbed(OFFICIAL_GHL_LOGIN_URL)).toBe(true);
    expect(hostRefusesEmbed(EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL)).toBe(true);
    expect(hostRefusesEmbed(OFFICIAL_TELEGRAM_LOGIN_URL)).toBe(true);
    expect(hostRefusesEmbed(OFFICIAL_DISPUTEFOX_LOGIN_URL)).toBe(false);
    expect(hostRefusesEmbed(COGNITO_OFFICIAL_LOGIN_URL)).toBe(false);
  });
});

describe("in-OS portal navigation", () => {
  it("keeps every sidebar click on an OS route, not a raw external-only href", () => {
    const required: Array<[string, string, string]> = [
      ["Inbox", "/inbox", OFFICIAL_GHL_LOGIN_URL],
      ["GHL", "/inbox?tab=ghl", OFFICIAL_GHL_LOGIN_URL],
      ["Dialer", "/dialer", OFFICIAL_GHL_LOGIN_URL],
      ["Telegram", "/team-chat", OFFICIAL_TELEGRAM_LOGIN_URL],
      ["DisputeFox", "/credit/disputefox", OFFICIAL_DISPUTEFOX_LOGIN_URL],
      ["Experian", "/credit/experian", EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL],
      ["Equifax", "/credit/equifax", DISPUTE_CHANNELS.EQUIFAX.officialSubmitUrl as string],
      ["TransUnion", "/credit/transunion", DISPUTE_CHANNELS.TRANSUNION.officialSubmitUrl as string],
      ["CFPB", "/escalations/cfpb", DISPUTE_CHANNELS.CFPB.officialSubmitUrl as string],
      ["Cognito", "/tax/cognito", COGNITO_OFFICIAL_LOGIN_URL],
      ["Cloud Tax Office", "/tax/cloud-tax-office", OFFICIAL_CLOUD_TAX_OFFICE_URL],
    ];

    const nav = getDesktopNav("OWNER");
    const html = renderToStaticMarkup(
      createElement(StaffShell, { user: OWNER, pathname: "/home" }, createElement("div")),
    );

    expect(html).not.toMatch(/target="_blank"/);
    expect(html).not.toMatch(/window\.open/);

    for (const [label, osHref, official] of required) {
      const item = nav.find((row) => row.label === label);
      expect(item, label).toBeTruthy();
      expect(item!.href).toBe(osHref);
      expect(sidebarClickHref(item!)).toBe(osHref);
      expect(isInOsNavHref(sidebarClickHref(item!))).toBe(true);
      expect(officialLoginForHref(osHref)).toBe(official);
      expect(html).toContain(`data-nav="${label}"`);
      expect(html).toContain(`data-nav-href="${osHref}"`);
      expect(html).toContain(`href="${osHref}"`);
      expect(html).not.toContain(`data-nav-href="${official}"`);
    }

    for (const item of nav) {
      expect(isInOsNavHref(sidebarClickHref(item)), item.label).toBe(true);
    }
    for (const item of getStaffNav("OWNER")) {
      expect(isInOsNavHref(sidebarClickHref(item)), item.label).toBe(true);
    }
  });

  it("maps each official desk to an in-OS portal route", () => {
    expect(portalDeskForLocation("/inbox")?.id).toBe("ghl-inbox");
    expect(portalDeskForLocation("/inbox?tab=ghl")?.officialUrl).toBe(OFFICIAL_GHL_LOGIN_URL);
    expect(portalDeskForLocation("/dialer")?.officialUrl).toBe(OFFICIAL_GHL_LOGIN_URL);
    expect(portalDeskForLocation("/team-chat")?.officialUrl).toBe(OFFICIAL_TELEGRAM_LOGIN_URL);
    expect(portalDeskForLocation("/credit/disputefox")?.officialUrl).toBe(OFFICIAL_DISPUTEFOX_LOGIN_URL);
    expect(portalDeskForLocation("/credit/experian")?.officialUrl).toBe(EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL);
    expect(portalDeskForLocation("/tax/cognito")?.officialUrl).toBe(COGNITO_OFFICIAL_LOGIN_URL);
    expect(PORTAL_DESKS.every((desk) => desk.osHref.startsWith("/") && desk.officialUrl.startsWith("https://"))).toBe(
      true,
    );
  });

  it("renders a full-desk iframe when the host allows embed", () => {
    const html = renderToStaticMarkup(createElement(PortalDesk, { deskId: "disputefox" }));
    expect(html).toContain('data-portal-desk="disputefox"');
    expect(html).toContain(`src="${OFFICIAL_DISPUTEFOX_LOGIN_URL}"`);
    expect(html).toMatch(/<iframe/i);
    expect(html).not.toMatch(/target="_blank"/);
    expect(html).not.toMatch(/GHL_API_KEY|DISPUTEFOX_API_KEY|API health|DEGRADED/);
  });

  it("uses an in-OS same-window stage when the host refuses embed", () => {
    const html = renderToStaticMarkup(createElement(PortalDesk, { deskId: "ghl" }));
    expect(html).toContain('data-portal-desk="ghl"');
    expect(html).toContain('data-embed-policy="refused"');
    expect(html).toContain(`action="${OFFICIAL_GHL_LOGIN_URL}"`);
    expect(html).toContain('target="_self"');
    expect(html).not.toMatch(/target="_blank"/);
    expect(html).not.toMatch(/GHL_API_KEY|Awaiting Integration|API health/);
    expect(portalDeskById("experian").officialUrl).toBe(EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL);
    const experian = renderToStaticMarkup(createElement(PortalDesk, { deskId: "experian" }));
    expect(experian).toContain(`action="${EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL}"`);
  });
});
