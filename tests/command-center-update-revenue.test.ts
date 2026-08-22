import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMMAND_CENTER_PERSIST_AFTER_RETURN_HREF,
  COMMAND_CENTER_TOTAL_REVENUE_HREF,
  COMMAND_CENTER_UPDATE_REVENUE_LABEL,
  COMMAND_CENTER_UPDATE_REVENUE_LOGIN_URL,
  assertLiveRevenueClickTargets,
  commandCenterRevenueClickTargets,
} from "../src/lib/tax/command-center-revenue-actions";
import {
  OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22,
  officialFeeSummaryFromCaptureKey,
  officialFeeSummaryPersistRows,
  officialPaidPayoutExternalId,
  officialUnfundedPayoutExternalId,
} from "../src/lib/tax/fee-summary-mapping";
import { loginHref, pathAfterLogin, safeStaffReturnTo } from "../src/lib/auth/return-to";
import { getPinnedSbtpgNav, TAX_NAV } from "../src/lib/nav/role-nav";
import { isLiveNavHref } from "../src/lib/nav/official-logins";
import { TAX_DESK_CATALOG } from "../src/lib/tax/catalog";

describe("Command Center click targets", () => {
  it("sends Total Revenue to the in-OS desk and Update revenue to official last-step login", () => {
    const targets = commandCenterRevenueClickTargets();
    expect(targets.totalRevenueHref).toBe("/tax/sbtpg");
    expect(targets.totalRevenueHref).toBe(TAX_DESK_CATALOG.SBTPG.href);
    expect(targets.updateRevenueHref).toBe("https://pro.sbtpg.com/login");
    expect(targets.updateRevenueHref).toBe(TAX_DESK_CATALOG.SBTPG.officialLastStepUrl);
    expect(targets.persistAfterReturnHref).toBe("/tax/sbtpg");
    expect(targets.updateRevenueLabel).toBe("Update revenue");
    expect(assertLiveRevenueClickTargets(targets)).toBe(true);
    expect(isLiveNavHref(COMMAND_CENTER_TOTAL_REVENUE_HREF)).toBe(true);
    expect(isLiveNavHref(COMMAND_CENTER_UPDATE_REVENUE_LOGIN_URL)).toBe(true);
    expect(isLiveNavHref(COMMAND_CENTER_PERSIST_AFTER_RETURN_HREF)).toBe(true);
    expect(COMMAND_CENTER_UPDATE_REVENUE_LABEL).toBe("Update revenue");
  });

  it("keeps the Total Revenue tile and SBTPG nav live", () => {
    const nav = getPinnedSbtpgNav();
    expect(nav.href).toBe("/tax/sbtpg");
    expect(nav.href).toBe(COMMAND_CENTER_TOTAL_REVENUE_HREF);
    expect(nav.href).toBe(TAX_NAV.sbtpg.href);
    expect(nav.href).not.toBe("#");
    expect(nav.href.trim()).not.toBe("");
    expect(isLiveNavHref(nav.href)).toBe(true);
    expect(nav.officialLastStepUrl).toBe("https://pro.sbtpg.com/login");
    expect(isLiveNavHref(nav.officialLastStepUrl ?? "")).toBe(true);

    const home = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/home/page.tsx"), "utf8");
    const login = fs.readFileSync(path.join(process.cwd(), "src/components/desk/OfficialLoginLink.tsx"), "utf8");
    const persist = fs.readFileSync(
      path.join(process.cwd(), "src/components/tax/OfficialFeeSummaryPersistForm.tsx"),
      "utf8",
    );
    expect(home).toMatch(/href=\{COMMAND_CENTER_TOTAL_REVENUE_HREF\}/);
    expect(home).toMatch(/label="Total Revenue"/);
    expect(home).toMatch(/href=\{COMMAND_CENTER_UPDATE_REVENUE_LOGIN_URL\}/);
    expect(home).toMatch(/label=\{COMMAND_CENTER_UPDATE_REVENUE_LABEL\}/);
    expect(home).toMatch(/OfficialFeeSummaryPersistForm/);
    expect(home).not.toMatch(/<iframe/i);
    expect(home).not.toMatch(/href="#"/);
    expect(login).toMatch(/target="_blank"/);
    expect(login).toMatch(/noopener noreferrer/);
    expect(login).not.toMatch(/iframe/i);
    expect(persist).toMatch(/SbtpgFeeSummaryIngestForm/);
    expect(persist).not.toMatch(/SBTPG/);
    expect(persist).not.toMatch(/taxpayer/i);
    expect(persist).not.toMatch(/117700|117,700/);
    expect(persist).not.toMatch(/cheerio|puppeteer|playwright/i);
  });
});

describe("login returnTo for Tax → SBTPG", () => {
  it("lands staff on /tax/sbtpg after auth and never returns to the official portal", () => {
    expect(safeStaffReturnTo("/tax/sbtpg")).toBe("/tax/sbtpg");
    expect(loginHref("/tax/sbtpg")).toBe("/login?returnTo=%2Ftax%2Fsbtpg");
    expect(pathAfterLogin("OWNER", "/tax/sbtpg")).toBe("/tax/sbtpg");
    expect(safeStaffReturnTo("https://pro.sbtpg.com/login")).toBeNull();
    expect(pathAfterLogin("OWNER", "https://pro.sbtpg.com/login")).toBe("/home");
  });
});

describe("staff-facing revenue attribution", () => {
  it("labels Command Center and finance tiles from Grants & Co Consultants, not from SBTPG", () => {
    const home = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/home/page.tsx"), "utf8");
    const dashboard = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/dashboard/page.tsx"), "utf8");
    const finance = fs.readFileSync(path.join(process.cwd(), "src/lib/payments/dashboard.ts"), "utf8");
    const desk = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/tax/sbtpg/page.tsx"), "utf8");
    for (const src of [home, dashboard, finance]) {
      expect(src).not.toMatch(/from SBTPG/);
      expect(src).not.toMatch(/SBTPG collected/);
      expect(src).not.toMatch(/via SBTPG/);
    }
    expect(home).toMatch(/STAFF_REVENUE_ATTRIBUTION/);
    expect(home).toMatch(/title="Revenue trend"/);
    expect(home).toMatch(/Total Company Revenue/);
    expect(home).toMatch(/STAFF_REVENUE_FIRM/);
    expect(home).toMatch(/SEASON-TO-DATE/);
    expect(home).not.toMatch(/SBTPG/);
    expect(finance).toMatch(/STAFF_REVENUE_ATTRIBUTION/);
    expect(desk).toMatch(/staffAttribution/);
    expect(desk).toMatch(/Official portal is SBTPG/);
  });
});

describe("official Fee Summary persist mapping", () => {
  it("maps the known capture onto snapshot + matching PAID/UNFUNDED payout rows", () => {
    const official = officialFeeSummaryFromCaptureKey("2026-08-22");
    expect(officialFeeSummaryFromCaptureKey("TY2026-2026-08-22")).toEqual(official);
    expect(official).toEqual({ ...OFFICIAL_SBTPG_FEE_SUMMARY_TY2026_2026_08_22 });
    expect(official.paidCents).toBe(11_770_000);
    expect(official.paidTaxpayerCount).toBe(73);
    expect(official.unfundedCents).toBe(2_100_000);
    expect(official.unfundedTaxpayerCount).toBe(12);

    const rows = officialFeeSummaryPersistRows(official);
    expect(rows.snapshot.paidCents).toBe(11_770_000);
    expect(rows.snapshot.unfundedCents).toBe(2_100_000);
    expect(rows.paidPayout).toEqual({
      amountCents: 11_770_000,
      status: "PAID",
      bucket: "FEE_SUMMARY_PAID",
      windowKind: "season_to_date",
      taxpayerCount: 73,
      externalId: officialPaidPayoutExternalId(official),
      taxYear: "2026",
      paidAt: "2026-08-22T12:00:00.000Z",
      source: "official_import",
    });
    expect(rows.unfundedPayout).toEqual({
      amountCents: 2_100_000,
      status: "UNFUNDED",
      bucket: "FEE_SUMMARY_UNFUNDED",
      windowKind: "season_to_date",
      taxpayerCount: 12,
      externalId: officialUnfundedPayoutExternalId(official),
      taxYear: "2026",
      paidAt: "2026-08-22T12:00:00.000Z",
      source: "official_import",
    });
    expect(rows.paidPayout.amountCents + (rows.unfundedPayout?.amountCents ?? 0)).toBe(13_870_000);
    expect(rows.paidPayout.amountCents).not.toBe(official.paidCents + official.unfundedCents);
  });

  it("does not invent a capture or dollar amounts for an unknown key", () => {
    expect(() => officialFeeSummaryFromCaptureKey("2026-08-23")).toThrow(
      "Unknown official SBTPG Fee Summary capture",
    );
    expect(() => officialFeeSummaryFromCaptureKey("invented")).toThrow(
      "Unknown official SBTPG Fee Summary capture",
    );
  });
});
