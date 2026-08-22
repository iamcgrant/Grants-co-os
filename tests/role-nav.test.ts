import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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
  type StaffRole,
} from "@/lib/nav/role-nav";

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
      { href: ESCALATIONS_NAV.cfpb.href, label: ESCALATIONS_NAV.cfpb.label, group: "escalations" },
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

  it("preserves working desktop items for owner", () => {
    const nav = getDesktopNav("OWNER");
    expect(hrefs(nav)).toEqual(
      expect.arrayContaining([
        "/home",
        "/clients",
        "/inbox",
        "/work",
        "/pay",
        "/credit/equifax",
        "/credit/transunion",
        "/credit/innovis",
        ESCALATIONS_NAV.cfpb.href,
      ]),
    );
    expect(nav.find((item) => item.label === "SmartCredit")?.href).toBe("/credit/smartcredit");
    expect(nav.find((item) => item.label === "Cloud Tax Office")?.href).toBe("/tax/cloud-tax-office");
    expect(nav.find((item) => item.label === "Cognito")?.href).toBe("/tax/cognito");
    expect(nav.find((item) => item.label === "SBTPG")?.href).toBe("/tax/sbtpg");
    expect(nav.find((item) => item.label === "SBTPG")?.group).toBe("primary");
    expect(nav.filter((item) => item.label === "SBTPG")).toHaveLength(1);
    expect(nav.findIndex((item) => item.label === "SBTPG")).toBeLessThan(8);
    expect(nav.find((item) => item.label === "Telegram")?.href).toBe("/team-chat");
    expect(nav.find((item) => item.label === "Gmail")?.href).toBe("/inbox?tab=gmail");
    const shell = fs.readFileSync(path.join(process.cwd(), "src/components/layout/StaffShell.tsx"), "utf8");
    expect(shell).toMatch(/data-nav=\{item\.label\}/);
    expect(shell).toMatch(/data-nav-href=\{item\.href\}/);
    expect(shell).toMatch(/TAX_NAV\.hub\.href/);
    expect(shell).not.toMatch(/pro\.sbtpg\.com/);
  });

  it("pins SBTPG on client-care and file-prep sidebars", () => {
    for (const role of ["CUSTOMER_SERVICE", "FILE_PREPARER"] as const) {
      const nav = getDesktopNav(role);
      expect(nav.find((item) => item.label === "SBTPG")?.href).toBe("/tax/sbtpg");
      expect(nav.find((item) => item.label === "SBTPG")?.group).toBe("primary");
      expect(nav.filter((item) => item.label === "SBTPG")).toHaveLength(1);
    }
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
      expect(src, file).not.toMatch(/Open portal|open portal/i);
      expect(src, file).not.toMatch(/https:\/\/www\.(experian|equifax|transunion|innovis|consumerfinance)/);
    }
    const df = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/credit/disputefox/page.tsx"), "utf8");
    expect(df).toMatch(/Clients/);
    expect(df).toMatch(/listDisputeFoxBoard/);
    const sc = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/credit/smartcredit/page.tsx"), "utf8");
    expect(sc).toMatch(/Clients/);
    expect(sc).toMatch(/listSmartCreditBoard/);
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
  });
});
