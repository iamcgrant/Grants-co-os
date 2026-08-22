import fs from "node:fs";
import path from "node:path";
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
  PORTAL_EMBED_INVESTIGATION,
  hostRefusesEmbed,
  portalDeskById,
  portalDeskCanEmbed,
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
        "www.equifax.com",
        "www.transunion.com",
        "www.consumerfinance.gov",
      ]),
    );
    expect(hosts).not.toContain("grantandco.cloudtaxoffice.com");
    expect(hostRefusesEmbed(OFFICIAL_GHL_LOGIN_URL)).toBe(true);
    expect(hostRefusesEmbed(EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL)).toBe(true);
    expect(hostRefusesEmbed(OFFICIAL_TELEGRAM_LOGIN_URL)).toBe(true);
    expect(hostRefusesEmbed(DISPUTE_CHANNELS.EQUIFAX.officialSubmitUrl as string)).toBe(true);
    expect(hostRefusesEmbed(OFFICIAL_DISPUTEFOX_LOGIN_URL)).toBe(false);
    expect(hostRefusesEmbed(COGNITO_OFFICIAL_LOGIN_URL)).toBe(false);
    expect(hostRefusesEmbed(OFFICIAL_CLOUD_TAX_OFFICE_URL)).toBe(false);
    expect(portalDeskById("cloud-tax-office").embed).toBe("try");
    expect(portalDeskCanEmbed(portalDeskById("ghl"))).toBe(false);
    expect(portalDeskCanEmbed(portalDeskById("telegram"))).toBe(false);
    expect(portalDeskCanEmbed(portalDeskById("experian"))).toBe(false);
    expect(portalDeskCanEmbed(portalDeskById("equifax"))).toBe(false);
    expect(portalDeskCanEmbed(portalDeskById("disputefox"))).toBe(true);
    expect(portalDeskCanEmbed(portalDeskById("cloud-tax-office"))).toBe(true);
    expect(PORTAL_EMBED_INVESTIGATION.ghl).toMatch(/SAMEORIGIN/);
    expect(PORTAL_EMBED_INVESTIGATION.telegram).toMatch(/deny/);
    expect(PORTAL_EMBED_INVESTIGATION.experian).toMatch(/frame-ancestors 'none'/);
    expect(PORTAL_EMBED_INVESTIGATION.equifax).toMatch(/frame-ancestors 'self'/);
    expect(PORTAL_EMBED_INVESTIGATION.proxy).toMatch(/No cookie-safe TOS-safe vendor reverse proxy/);
    const vercel = fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8");
    expect(vercel).toMatch(/"rewrites":\s*\[\s*\]/);
    const proxy = fs.readFileSync(path.join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(proxy).toMatch(/x-gc-pathname/);
    expect(proxy).not.toMatch(/gohighlevel|telegram\.org|experian\.com|equifax\.com/i);
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

  it("sidebar clicks never assign window.location to a vendor origin", () => {
    const guarded = [
      "src/components/layout/StaffShell.tsx",
      "src/components/layout/StaffShellClient.tsx",
      "src/lib/nav/official-logins.ts",
      "src/lib/nav/role-nav.ts",
      "src/components/desk/PortalDesk.tsx",
      "src/components/desk/GuardedPortalDesk.tsx",
    ];
    for (const file of guarded) {
      const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(src, file).not.toMatch(/window\.location|location\.assign|location\.replace|location\.href\s*=/);
    }

    const html = renderToStaticMarkup(
      createElement(StaffShell, { user: OWNER, pathname: "/home" }, createElement("div")),
    );
    expect(html).not.toMatch(/window\.location|location\.assign|location\.replace/);
    for (const desk of PORTAL_DESKS) {
      expect(html, desk.id).not.toContain(`href="${desk.officialUrl}"`);
      expect(html, desk.id).toContain(`data-nav-href="${desk.osHref}"`);
    }
  });

  it("loads embeddable official logins in the desk iframe and never leaves the OS", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/components/desk/PortalDesk.tsx"), "utf8");
    expect(src).not.toMatch(/window\.location|location\.assign|location\.replace|location\.href\s*=/);
    expect(src).not.toMatch(/target="_blank"|target="_self"/);
    expect(src).not.toMatch(/PortalContinue|data-portal-continue/);

    for (const desk of PORTAL_DESKS) {
      const html = renderToStaticMarkup(createElement(PortalDesk, { deskId: desk.id }));
      expect(html, desk.id).toContain(`data-portal-desk="${desk.id}"`);
      expect(html, desk.id).toContain(`data-official-url="${desk.officialUrl}"`);
      expect(html, desk.id).toContain("Return to OS");
      expect(html, desk.id).toContain('href="/home"');
      expect(html, desk.id).not.toMatch(/target="_blank"|target="_self"/);
      expect(html, desk.id).not.toContain(`href="${desk.officialUrl}"`);
      expect(html, desk.id).not.toMatch(/Continue|refuses an in-desk embed|OFFICIAL LOGIN/i);
      expect(html, desk.id).not.toMatch(/GHL_API_KEY|TELEGRAM_BOT_TOKEN|API health|DEGRADED/);

      if (portalDeskCanEmbed(desk)) {
        expect(html, desk.id).toContain(`data-embed-policy="pane"`);
        expect(html, desk.id).toContain(`src="${desk.officialUrl}"`);
        expect(html, desk.id).toMatch(/<iframe/i);
        expect(html, desk.id).not.toContain('data-portal-stage="desk"');
      } else {
        expect(html, desk.id).toContain(`data-embed-policy="desk"`);
        expect(html, desk.id).toContain('data-portal-stage="desk"');
        expect(html, desk.id).toContain("Grants &amp; Co");
        expect(html, desk.id).toContain(desk.officialUrl);
        expect(html, desk.id).toMatch(/does not invent a proxy or a key/);
        expect(html, desk.id).not.toMatch(/<iframe/i);
      }
    }
  });

  it("Telegram and DisputeFox pages are official login desks with no key theater", () => {
    const telegramPage = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/team-chat/page.tsx"), "utf8");
    const foxPage = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/credit/disputefox/page.tsx"), "utf8");
    expect(telegramPage).toMatch(/deskId: "telegram"/);
    expect(telegramPage).toMatch(/GuardedPortalDesk/);
    expect(telegramPage).not.toMatch(/TELEGRAM_BOT_TOKEN|TelegramTeamInbox|fail-closed/i);
    expect(foxPage).toMatch(/deskId: "disputefox"/);
    expect(foxPage).toMatch(/GuardedPortalDesk/);
    expect(foxPage).not.toMatch(/DISPUTEFOX_API_PROBE|API health|DEGRADED|loadDisputeFoxDesk/);
    expect(portalDeskById("telegram").officialUrl).toBe("https://web.telegram.org/a/");
    expect(portalDeskById("disputefox").officialUrl).toBe(
      "https://pulse.disputeprocess.com/jsp/client/login.jsp",
    );
  });
});
