import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CREDIT_DISPUTES_NAV,
  ESCALATIONS_NAV,
  getCreditDisputesNav,
  getDesktopNav,
  getEscalationsNav,
  getStaffNav,
  hasCreditDisputesNav,
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
    expect(CREDIT_DISPUTES_NAV.smartCredit.href).toBe("/credit-pulse");
  });

  it("labels Credit & Disputes and Escalations sections", () => {
    expect(navSectionLabel("credit")).toBe("Credit & Disputes");
    expect(navSectionLabel("escalations")).toBe("Escalations");
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
    expect(nav.find((item) => item.label === "SmartCredit")?.href).toBe("/credit-pulse");
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
      "src/app/(staff)/escalations/cfpb/page.tsx",
      "src/app/(staff)/credit/credit-karma/page.tsx",
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
    const ck = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/credit/credit-karma/page.tsx"), "utf8");
    expect(ck).toMatch(/Client-assisted/);
  });
});
