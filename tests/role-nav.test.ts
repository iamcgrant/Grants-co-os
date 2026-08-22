import fs from "node:fs";
import path from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CREDIT_DISPUTES_NAV,
  ESCALATIONS_NAV,
  TAX_NAV,
  getCreditDisputesNav,
  getDesktopNav,
  getDesktopTaxNav,
  getEscalationsNav,
  getPinnedSbtpgNav,
  getStaffNav,
  getTaxNav,
  hasCreditDisputesNav,
  hasTaxNav,
  navSectionLabel,
  type NavItem,
  type StaffRole,
} from "@/lib/nav/role-nav";
import {
  EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL,
  EXPERIAN_OFFICIAL_CONSUMER_DISPUTE_URL,
  GMAIL_WORK_MAILBOX,
  OFFICIAL_GHL_LOGIN_URL,
  OFFICIAL_GMAIL_LOGIN_URL,
  OFFICIAL_TELEGRAM_LOGIN_URL,
  experianOfficialClickUrl,
  isLiveNavHref,
  isOfficialHttpsHref,
  officialLoginForHref,
  sidebarClickHref,
} from "@/lib/nav/official-logins";
import { DISPUTE_CHANNELS } from "@/lib/disputes/channels";
import { TAX_DESK_CATALOG } from "@/lib/tax/catalog";
import { COGNITO_OFFICIAL_LOGIN_URL } from "@/lib/integrations/cognito/config";
import { StaffShell } from "@/components/layout/StaffShell";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

vi.mock("next/image", () => ({
  default: (props: { alt?: string }) => createElement("img", { alt: props.alt || "logo" }),
}));

const CREDIT_ROLES: StaffRole[] = ["OWNER", "ADMIN", "CUSTOMER_SERVICE", "FILE_PREPARER"];
const NON_CREDIT_ROLES: StaffRole[] = ["MANAGER", "MARKETING", "CLIENT"];

function labels(items: { label: string }[]) {
  return items.map((item) => item.label);
}

function hrefs(items: { href: string }[]) {
  return items.map((item) => item.href);
}

describe("Credit & Disputes navigation", () => {
  it("exposes DisputeFox, bureau cases, SmartCredit, Credit Karma, then CFPB", () => {
    expect(labels(getCreditDisputesNav())).toEqual([
      "DisputeFox",
      "Experian",
      "Equifax",
      "TransUnion",
      "Innovis",
      "SmartCredit",
      "Credit Karma",
    ]);
    expect(getEscalationsNav()).toEqual([
      {
        href: ESCALATIONS_NAV.cfpb.href,
        label: ESCALATIONS_NAV.cfpb.label,
        group: "escalations",
        officialLastStepUrl: DISPUTE_CHANNELS.CFPB.officialSubmitUrl ?? undefined,
      },
    ]);
    expect(CREDIT_DISPUTES_NAV.smartCredit.href).toBe("/credit/smartcredit");
  });

  it("labels Credit & Disputes and Escalations sections", () => {
    expect(navSectionLabel("credit")).toBe("Credit & Disputes");
    expect(navSectionLabel("escalations")).toBe("Escalations");
    expect(navSectionLabel("tax")).toBe("Tax");
  });

  it("exposes Cloud Tax Office, Cognito, and SBTPG as native tax desks", () => {
    expect(labels(getTaxNav())).toEqual(["Cloud Tax Office", "Cognito", "SBTPG"]);
    expect(TAX_NAV.cloudTaxOffice.href).toBe("/tax/cloud-tax-office");
    expect(TAX_NAV.cognito.href).toBe("/tax/cognito");
    expect(TAX_NAV.sbtpg.href).toBe("/tax/sbtpg");
    expect(getPinnedSbtpgNav()).toEqual({ href: "/tax/sbtpg", label: "SBTPG", group: "primary" });
    expect(labels(getDesktopTaxNav())).toEqual(["Cloud Tax Office", "Cognito"]);
    for (const role of CREDIT_ROLES) expect(hasTaxNav(role)).toBe(true);
    for (const role of NON_CREDIT_ROLES) expect(hasTaxNav(role)).toBe(false);
  });

  it("role-gates credit nav like existing staff credit access", () => {
    for (const role of CREDIT_ROLES) expect(hasCreditDisputesNav(role)).toBe(true);
    for (const role of NON_CREDIT_ROLES) expect(hasCreditDisputesNav(role)).toBe(false);
  });

  it("lists every owner desktop nav href as a live native route or official login", () => {
    const nav = getDesktopNav("OWNER");
    const listed = hrefs(nav);
    expect(listed).toEqual([
      "/home",
      "/clients",
      "/inbox",
      "/inbox?tab=ghl",
      "/inbox?tab=gmail",
      "/dialer",
      "/team-chat",
      "/tax/sbtpg",
      "/work",
      "/credit/disputefox",
      "/credit/experian",
      "/credit/equifax",
      "/credit/transunion",
      "/credit/innovis",
      "/credit/smartcredit",
      "/credit/credit-karma",
      "/escalations/cfpb",
      "/tax/cloud-tax-office",
      "/tax/cognito",
      "/pay",
      "/intelligence",
      "/acquisition",
      "/automations",
      "/system-health",
      "/agents",
      "/more",
    ]);
    for (const href of listed) {
      expect(href, href).not.toBe("#");
      expect(href.trim(), href).not.toBe("");
      expect(isLiveNavHref(href), href).toBe(true);
      if (href.startsWith("/")) {
        const base = href.split("?")[0];
        const page = path.join(process.cwd(), "src/app/(staff)", base.replace(/^\//, ""), "page.tsx");
        expect(fs.existsSync(page), page).toBe(true);
      }
    }
    expect(nav.find((item) => item.label === "SmartCredit")?.href).toBe("/credit/smartcredit");
    expect(nav.find((item) => item.label === "Cloud Tax Office")?.href).toBe("/tax/cloud-tax-office");
    expect(nav.find((item) => item.label === "Cognito")?.href).toBe("/tax/cognito");
    expect(nav.find((item) => item.label === "SBTPG")?.href).toBe("/tax/sbtpg");
    expect(nav.find((item) => item.label === "SBTPG")?.group).toBe("primary");
    expect(nav.filter((item) => item.label === "SBTPG")).toHaveLength(1);
    expect(nav.findIndex((item) => item.label === "SBTPG")).toBeLessThan(8);
    expect(nav.find((item) => item.label === "Telegram")?.href).toBe("/team-chat");
    expect(nav.find((item) => item.label === "Gmail")?.href).toBe("/inbox?tab=gmail");
    expect(nav.find((item) => item.label === "GHL")?.href).toBe("/inbox?tab=ghl");
    const shell = fs.readFileSync(path.join(process.cwd(), "src/components/layout/StaffShell.tsx"), "utf8");
    expect(shell).toMatch(/data-nav=\{item\.label\}/);
    expect(shell).toMatch(/data-nav-href=\{clickHref\}/);
    expect(shell).toMatch(/sidebarClickHref/);
    expect(shell).toMatch(/TAX_NAV\.hub\.href/);
    expect(shell).not.toMatch(/pro\.sbtpg\.com/);
    expect(shell).not.toMatch(/<iframe/i);
  });

  it("pins SBTPG on client-care and file-prep sidebars", () => {
    for (const role of ["CUSTOMER_SERVICE", "FILE_PREPARER"] as const) {
      const nav = getDesktopNav(role);
      expect(nav.find((item) => item.label === "SBTPG")?.href).toBe("/tax/sbtpg");
      expect(nav.find((item) => item.label === "SBTPG")?.group).toBe("primary");
      expect(nav.filter((item) => item.label === "SBTPG")).toHaveLength(1);
    }
  });

  it("attaches official last-step logins from catalogs for product desks", () => {
    const nav = getDesktopNav("OWNER");
    const byLabel = Object.fromEntries(nav.map((item) => [item.label, item])) as Record<string, NavItem>;
    expect(byLabel.Inbox.officialLastStepUrl).toBe(OFFICIAL_GHL_LOGIN_URL);
    expect(byLabel.GHL.officialLastStepUrl).toBe(OFFICIAL_GHL_LOGIN_URL);
    expect(byLabel.Gmail.officialLastStepUrl).toBe(OFFICIAL_GMAIL_LOGIN_URL);
    expect(byLabel.Dialer.officialLastStepUrl).toBe(OFFICIAL_GHL_LOGIN_URL);
    expect(byLabel.Telegram.officialLastStepUrl).toBe(OFFICIAL_TELEGRAM_LOGIN_URL);
    expect(byLabel.DisputeFox.officialLastStepUrl).toBe(DISPUTE_CHANNELS.DISPUTEFOX.officialSubmitUrl);
    expect(byLabel.Experian.officialLastStepUrl).toBe(DISPUTE_CHANNELS.EXPERIAN.officialSubmitUrl);
    expect(byLabel.Equifax.officialLastStepUrl).toBe(DISPUTE_CHANNELS.EQUIFAX.officialSubmitUrl);
    expect(byLabel.TransUnion.officialLastStepUrl).toBe(DISPUTE_CHANNELS.TRANSUNION.officialSubmitUrl);
    expect(byLabel.Innovis.officialLastStepUrl).toBe(DISPUTE_CHANNELS.INNOVIS.officialSubmitUrl);
    expect(byLabel.SmartCredit.officialLastStepUrl).toBe(DISPUTE_CHANNELS.SMARTCREDIT.officialSubmitUrl);
    expect(byLabel.CFPB.officialLastStepUrl).toBe(DISPUTE_CHANNELS.CFPB.officialSubmitUrl);
    expect(byLabel["Cloud Tax Office"].officialLastStepUrl).toBe(TAX_DESK_CATALOG.CLOUD_TAX_OFFICE.officialLastStepUrl);
    expect(byLabel.Cognito.officialLastStepUrl).toBe(COGNITO_OFFICIAL_LOGIN_URL);
    expect(byLabel.SBTPG.officialLastStepUrl).toBe(TAX_DESK_CATALOG.SBTPG.officialLastStepUrl);
    expect(TAX_DESK_CATALOG.CLOUD_TAX_OFFICE.officialLastStepUrl).toBe(
      "https://grantandco.cloudtaxoffice.com/proavalon/",
    );
    expect(TAX_DESK_CATALOG.SBTPG.officialLastStepUrl).toBe("https://pro.sbtpg.com/login");
    expect(DISPUTE_CHANNELS.DISPUTEFOX.officialSubmitUrl).toBe("https://pulse.disputeprocess.com");
    expect(EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL).toBeNull();
    expect(experianOfficialClickUrl()).toBe(EXPERIAN_OFFICIAL_CONSUMER_DISPUTE_URL);
    expect(DISPUTE_CHANNELS.EXPERIAN.officialSubmitUrl).toBe(EXPERIAN_OFFICIAL_CONSUMER_DISPUTE_URL);
    expect(COGNITO_OFFICIAL_LOGIN_URL).toBe("https://www.cognitoforms.com/login");
    expect(GMAIL_WORK_MAILBOX).toBe("cgrant@grantandconsultants.com");
    expect(officialLoginForHref("/credit/credit-karma")).toBeUndefined();
    for (const item of nav) {
      if (item.officialLastStepUrl) {
        expect(item.officialLastStepUrl.startsWith("https://"), item.label).toBe(true);
      }
    }
  });

  it("uses a real https official href on click for required sidebar labels", () => {
    const nav = getDesktopNav("OWNER");
    const required: Array<[string, string]> = [
      ["TransUnion", DISPUTE_CHANNELS.TRANSUNION.officialSubmitUrl as string],
      ["Equifax", DISPUTE_CHANNELS.EQUIFAX.officialSubmitUrl as string],
      ["Experian", experianOfficialClickUrl()],
      ["CFPB", DISPUTE_CHANNELS.CFPB.officialSubmitUrl as string],
      ["DisputeFox", DISPUTE_CHANNELS.DISPUTEFOX.officialSubmitUrl as string],
      ["GHL", OFFICIAL_GHL_LOGIN_URL],
      ["Inbox", OFFICIAL_GHL_LOGIN_URL],
      ["Dialer", OFFICIAL_GHL_LOGIN_URL],
      ["Telegram", OFFICIAL_TELEGRAM_LOGIN_URL],
    ];
    const html = renderToStaticMarkup(
      createElement(
        StaffShell,
        {
          user: {
            id: "owner-1",
            email: "owner@grantsandco.com",
            firstName: "Charles",
            lastName: "Grant",
            role: "OWNER",
            isActive: true,
            mfaEnabled: false,
          },
          pathname: "/home",
        },
        createElement("div"),
      ),
    );
    expect(html).not.toMatch(/<iframe/i);
    for (const [label, official] of required) {
      const item = nav.find((row) => row.label === label);
      expect(item, label).toBeTruthy();
      expect(isOfficialHttpsHref(official), label).toBe(true);
      expect(sidebarClickHref(item!), official).toBe(official);
      expect(html).toContain(`data-nav="${label}"`);
      expect(html).toContain(`data-nav-href="${official}"`);
      expect(html).toContain(`href="${official}"`);
    }
    expect(EXPERIAN_BACKDOOR_SUBMIT_PORTAL_URL).toBeNull();
    expect(html).not.toMatch(/iframe/);
  });

  it("keeps mobile bottom nav lean", () => {
    const mobile = getStaffNav("OWNER");
    expect(mobile.length).toBeLessThanOrEqual(9);
    expect(hrefs(mobile)).toEqual(
      expect.arrayContaining([
        "/home",
        "/clients",
        "/inbox",
        "/dialer",
        "/work",
        CREDIT_DISPUTES_NAV.hub.href,
      ]),
    );
  });

  it("lists customer-service and file-preparer desktop hrefs as live", () => {
    for (const role of ["CUSTOMER_SERVICE", "FILE_PREPARER"] as const) {
      const listed = hrefs(getDesktopNav(role));
      expect(listed.length).toBeGreaterThan(0);
      for (const href of listed) {
        expect(href, `${role} ${href}`).not.toBe("#");
        expect(href.trim(), `${role} ${href}`).not.toBe("");
        expect(isLiveNavHref(href), `${role} ${href}`).toBe(true);
      }
    }
  });

  it("workspace pages are native OS screens and do not scrape", () => {
    const files = [
      "src/app/(staff)/credit/disputefox/page.tsx",
      "src/app/(staff)/credit/experian/page.tsx",
      "src/app/(staff)/credit/equifax/page.tsx",
      "src/app/(staff)/credit/transunion/page.tsx",
      "src/app/(staff)/credit/innovis/page.tsx",
      "src/app/(staff)/credit/smartcredit/page.tsx",
      "src/app/(staff)/escalations/cfpb/page.tsx",
      "src/app/(staff)/credit/credit-karma/page.tsx",
      "src/app/(staff)/tax/cloud-tax-office/page.tsx",
      "src/app/(staff)/tax/cognito/page.tsx",
      "src/app/(staff)/tax/sbtpg/page.tsx",
    ];
    for (const file of files) {
      const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(src, file).toMatch(/Access denied/);
      expect(src, file).not.toMatch(/cheerio|puppeteer|playwright/i);
      expect(src, file).not.toMatch(/<iframe/i);
      expect(src, file).not.toMatch(/Open portal|open portal/i);
    }
    const df = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/credit/disputefox/page.tsx"), "utf8");
    expect(df).toMatch(/Clients/);
    expect(df).toMatch(/loadDisputeFoxDeskSafe/);
    const sc = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/credit/smartcredit/page.tsx"), "utf8");
    expect(sc).toMatch(/Clients/);
    expect(sc).toMatch(/loadSmartCreditDeskSafe/);
    expect(sc).toMatch(/SmartCreditAttachForm/);
    expect(sc).toMatch(/SmartCreditSessionForm/);
    const ck = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/credit/credit-karma/page.tsx"), "utf8");
    expect(ck).toMatch(/Client-assisted/);
    const tax = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/tax/cloud-tax-office/page.tsx"), "utf8");
    expect(tax).toMatch(/listTaxDeskBoard/);
    expect(tax).toMatch(/TaxDeskAttachForm/);
    const cognito = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/tax/cognito/page.tsx"), "utf8");
    expect(cognito).toMatch(/CognitoPullForm/);
    const sbtpg = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/tax/sbtpg/page.tsx"), "utf8");
    expect(sbtpg).toMatch(/loadSbtpgDesk/);
    expect(sbtpg).toMatch(/data-sbtpg-desk/);
    expect(sbtpg).toMatch(/data-sbtpg-paid/);
    expect(sbtpg).not.toMatch(/coming soon/i);
    expect(sbtpg).toMatch(/loginUrl=\{catalog\.officialLastStepUrl\}/);
    expect(tax).toMatch(/loginUrl=\{catalog\.officialLastStepUrl\}/);
    expect(cognito).toMatch(/loginUrl=\{COGNITO_OFFICIAL_LOGIN_URL\}/);
    const empty = fs.readFileSync(path.join(process.cwd(), "src/components/desk/DeskEmptyState.tsx"), "utf8");
    const login = fs.readFileSync(path.join(process.cwd(), "src/components/desk/OfficialLoginLink.tsx"), "utf8");
    const launch = fs.readFileSync(path.join(process.cwd(), "src/components/desk/OpenPortalLaunch.tsx"), "utf8");
    const channelView = fs.readFileSync(path.join(process.cwd(), "src/components/disputes/ChannelCasesView.tsx"), "utf8");
    expect(empty).toMatch(/OfficialLoginLink/);
    expect(login).toMatch(/Open login/);
    expect(launch).toMatch(/Open portal/);
    expect(launch).toMatch(/window\.open/);
    expect(channelView).toMatch(/OpenPortalLaunch/);
    expect(df).toMatch(/OpenPortalLaunch/);
    expect(empty).not.toMatch(/iframe/i);
    expect(login).not.toMatch(/iframe/i);
    expect(launch).not.toMatch(/iframe/i);
    expect(channelView).not.toMatch(/<iframe/i);
  });
});
