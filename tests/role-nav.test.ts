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

describe("Credit & Disputes navigation (BUILDX slice 2)", () => {
  it("exposes DisputeFox, Experian, SmartCredit, Credit Karma, then CFPB", () => {
    expect(getCreditDisputesNav().map((item) => [item.label, item.href, item.group])).toEqual([
      [CREDIT_DISPUTES_NAV.disputeFox.label, CREDIT_DISPUTES_NAV.disputeFox.href, "credit"],
      [CREDIT_DISPUTES_NAV.experian.label, CREDIT_DISPUTES_NAV.experian.href, "credit"],
      [CREDIT_DISPUTES_NAV.smartCredit.label, CREDIT_DISPUTES_NAV.smartCredit.href, "credit"],
      [CREDIT_DISPUTES_NAV.creditKarma.label, CREDIT_DISPUTES_NAV.creditKarma.href, "credit"],
    ]);
    expect(getEscalationsNav()).toEqual([
      { href: ESCALATIONS_NAV.cfpb.href, label: ESCALATIONS_NAV.cfpb.label, group: "escalations" },
    ]);
    expect(CREDIT_DISPUTES_NAV.smartCredit.href).toBe("/credit-pulse");
    expect(CREDIT_DISPUTES_NAV.disputeFox.href).not.toMatch(/disputefox\.com|\/api\//);
  });

  it("labels Credit & Disputes and Escalations sections", () => {
    expect(navSectionLabel("credit")).toBe("Credit & Disputes");
    expect(navSectionLabel("escalations")).toBe("Escalations");
    expect(navSectionLabel("ops")).toBe("Operations");
    expect(navSectionLabel("primary")).toBeNull();
  });

  it("role-gates credit nav like existing staff credit access", () => {
    for (const role of CREDIT_ROLES) expect(hasCreditDisputesNav(role)).toBe(true);
    for (const role of NON_CREDIT_ROLES) expect(hasCreditDisputesNav(role)).toBe(false);
  });

  it("preserves working desktop items for owner while adding the credit structure", () => {
    const nav = getDesktopNav("OWNER");
    expect(hrefs(nav)).toEqual(
      expect.arrayContaining([
        "/home",
        "/clients",
        "/inbox",
        "/work",
        "/pay",
        "/intelligence",
        "/acquisition",
        "/automations",
        "/system-health",
        "/team-chat",
        "/agents",
        "/more",
        CREDIT_DISPUTES_NAV.disputeFox.href,
        CREDIT_DISPUTES_NAV.experian.href,
        CREDIT_DISPUTES_NAV.smartCredit.href,
        CREDIT_DISPUTES_NAV.creditKarma.href,
        ESCALATIONS_NAV.cfpb.href,
      ]),
    );
    expect(labels(nav)).toEqual(
      expect.arrayContaining(["DisputeFox", "Experian", "SmartCredit", "Credit Karma", "CFPB"]),
    );
    expect(nav.find((item) => item.label === "SmartCredit")?.href).toBe("/credit-pulse");
  });

  it("keeps mobile bottom nav lean and points Credit at the hub", () => {
    const mobile = getStaffNav("OWNER");
    expect(mobile.length).toBeLessThanOrEqual(8);
    expect(mobile.some((item) => item.href === CREDIT_DISPUTES_NAV.hub.href && item.short === "Credit")).toBe(
      true,
    );
    expect(hrefs(mobile)).toEqual(
      expect.arrayContaining(["/home", "/clients", "/inbox", "/work", "/pay", "/agents", "/more"]),
    );
    expect(hrefs(getStaffNav("MARKETING"))).not.toContain(CREDIT_DISPUTES_NAV.hub.href);
    expect(hrefs(getDesktopNav("MARKETING"))).not.toContain(CREDIT_DISPUTES_NAV.disputeFox.href);
  });

  it("customer-service and file-preparer get the same credit structure", () => {
    for (const role of ["CUSTOMER_SERVICE", "FILE_PREPARER"] as const) {
      expect(labels(getDesktopNav(role))).toEqual(
        expect.arrayContaining(["DisputeFox", "Experian", "SmartCredit", "Credit Karma", "CFPB"]),
      );
    }
  });

  it("staff shells exist and refuse vendor APIs / scrape", () => {
    const files = [
      "src/app/(staff)/credit/page.tsx",
      "src/app/(staff)/credit/disputefox/page.tsx",
      "src/app/(staff)/credit/experian/page.tsx",
      "src/app/(staff)/credit/credit-karma/page.tsx",
      "src/app/(staff)/escalations/cfpb/page.tsx",
    ];
    for (const file of files) {
      const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(src, file).toMatch(/Access denied/);
      expect(src, file).not.toMatch(/cheerio|puppeteer|playwright/i);
      expect(src, file).not.toMatch(/experian\.com\/|cfpb\.gov\/|creditkarma\.com\/|disputefox\.com\/api/i);
    }
    const experian = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/credit/experian/page.tsx"), "utf8");
    expect(experian).toMatch(/Experian/);
    expect(experian).toMatch(/No Experian API/);
    const karma = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/credit/credit-karma/page.tsx"), "utf8");
    expect(karma).toMatch(/Client-assisted/);
    const cfpb = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/escalations/cfpb/page.tsx"), "utf8");
    expect(cfpb).toMatch(/No CFPB API/);
    const df = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/credit/disputefox/page.tsx"), "utf8");
    expect(df).toMatch(/\/work\?view=jona/);
    expect(df).toMatch(/\/clients/);
  });
});
