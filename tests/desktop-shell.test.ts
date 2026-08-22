import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StaffShell } from "@/components/layout/StaffShell";
import { PortalDesk } from "@/components/desk/PortalDesk";
import { loginHref, pathAfterLogin } from "@/lib/auth/return-to";
import {
  DESKTOP_SHELL_COOKIE,
  DESKTOP_SHELL_VALUE,
  resolveDesktopShellMode,
  withDesktopShellQuery,
} from "@/lib/nav/desktop-shell";
import { ELECTRON_SIDEBAR_DESKS } from "@/lib/nav/desktop-os-desks";

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

const require = createRequire(import.meta.url);
const electronDesks = require("../desktop-electron/src/main/desks") as {
  DESKS: Array<{
    id: string;
    title: string;
    startUrl: string;
    partition: string;
    allowedHosts: string[];
    kind: "os" | "vendor";
  }>;
};

describe("desktop shell detection", () => {
  it("turns on from query or cookie and off from gc_shell=off", () => {
    expect(resolveDesktopShellMode({ queryValue: "app" })).toBe(true);
    expect(resolveDesktopShellMode({ cookieValue: "app" })).toBe(true);
    expect(resolveDesktopShellMode({ pathWithSearch: "/home?gc_shell=app" })).toBe(true);
    expect(resolveDesktopShellMode({})).toBe(false);
    expect(resolveDesktopShellMode({ cookieValue: "app", queryValue: "off" })).toBe(false);
    expect(resolveDesktopShellMode({ cookieValue: "app", pathWithSearch: "/home?gc_shell=off" })).toBe(
      false,
    );
    expect(withDesktopShellQuery("/home")).toBe("/home?gc_shell=app");
    expect(withDesktopShellQuery("/inbox?tab=work")).toBe("/inbox?tab=work&gc_shell=app");
  });

  it("preserves gc_shell=app after login and on login return", () => {
    expect(pathAfterLogin("OWNER", null, true)).toBe("/home?gc_shell=app");
    expect(pathAfterLogin("ADMIN", "/clients", true)).toBe("/clients?gc_shell=app");
    expect(pathAfterLogin("OWNER", "/home?gc_shell=app")).toBe("/home?gc_shell=app");
    expect(pathAfterLogin("CLIENT", "/home", true)).toBe("/portal");
    expect(loginHref("/home?gc_shell=app")).toBe("/login?gc_shell=app&returnTo=%2Fhome");
    expect(loginHref("/clients")).toBe("/login?returnTo=%2Fclients");
  });

  it("sets and clears the first-party httpOnly cookie in proxy", () => {
    const proxy = fs.readFileSync(path.join(process.cwd(), "src/proxy.ts"), "utf8");
    const helper = fs.readFileSync(path.join(process.cwd(), "src/lib/nav/desktop-shell.ts"), "utf8");
    expect(proxy).toMatch(/DESKTOP_SHELL_COOKIE/);
    expect(proxy).toMatch(/desktopShellCookieOptions/);
    expect(proxy).toMatch(/isDesktopShellOff/);
    expect(proxy).toMatch(/cookies\.delete/);
    expect(helper).toMatch(/httpOnly: true/);
    expect(helper).toMatch(/sameSite: "lax"/);
    expect(DESKTOP_SHELL_COOKIE).toBe("gc_shell");
    expect(DESKTOP_SHELL_VALUE).toBe("app");
  });
});

describe("StaffShell desktop presentation", () => {
  it("renders only page content when desktop shell mode is on", () => {
    const html = renderToStaticMarkup(
      createElement(
        StaffShell,
        { user: OWNER, pathname: "/home", desktopShell: true },
        createElement("main", { "data-page": "home" }, "Command Center"),
      ),
    );
    expect(html).toContain("Command Center");
    expect(html).toContain('data-page="home"');
    expect(html).toContain("gc-desktop-shell");
    expect(html).not.toContain("gc-sidebar");
    expect(html).not.toContain("gc-topbar");
    expect(html).not.toContain("gc-nav-mobile");
    expect(html).not.toContain("Return to OS");
    expect(html).not.toContain("data-nav=");
  });

  it("keeps the full website chrome for browser users", () => {
    const html = renderToStaticMarkup(
      createElement(StaffShell, { user: OWNER, pathname: "/home" }, createElement("div", null, "page")),
    );
    expect(html).toContain("gc-sidebar");
    expect(html).toContain("gc-topbar");
    expect(html).toContain('data-nav="Experian"');
  });

  it("hides Return to OS on portal desks in desktop shell mode", () => {
    const html = renderToStaticMarkup(
      createElement(PortalDesk, { deskId: "experian", desktopShell: true }),
    );
    expect(html).not.toContain("Return to OS");
    expect(html).not.toContain("data-return-to-os");
    expect(html).toContain('data-desktop-shell="true"');
    const browser = renderToStaticMarkup(createElement(PortalDesk, { deskId: "experian" }));
    expect(browser).toContain("Return to OS");
  });
});

describe("desktop-electron catalog lockstep", () => {
  it("is exactly the 8 proven desks, not getDesktopNav(OWNER)", () => {
    expect(electronDesks.DESKS).toHaveLength(8);
    expect(electronDesks.DESKS.map((desk) => desk.id)).toEqual(
      ELECTRON_SIDEBAR_DESKS.map((desk) => desk.id),
    );
    expect(electronDesks.DESKS.map((desk) => desk.title)).toEqual([
      "Home",
      "GHL",
      "Telegram",
      "Experian",
      "Equifax",
      "DisputeFox",
      "Cloud Tax",
      "CFPB",
    ]);
    expect(electronDesks.DESKS.map((desk) => desk.startUrl)).toEqual(
      ELECTRON_SIDEBAR_DESKS.map((desk) => desk.startUrl),
    );
    expect(electronDesks.DESKS.some((desk) => desk.title === "Gmail")).toBe(false);
    expect(electronDesks.DESKS.some((desk) => desk.title === "Clients")).toBe(false);
    expect(electronDesks.DESKS.some((desk) => desk.title === "Cognito")).toBe(false);
  });

  it("never uses OS iframe fallback routes as vendor start URLs", () => {
    const vendor = electronDesks.DESKS.filter((desk) => desk.kind === "vendor");
    expect(vendor.find((desk) => desk.title === "Experian")?.startUrl).toBe(
      "https://www.experian.com/consumer/upload/",
    );
    expect(vendor.find((desk) => desk.title === "GHL")?.startUrl).toBe("https://app.gohighlevel.com/");
    expect(vendor.find((desk) => desk.title === "Telegram")?.startUrl).toBe(
      "https://web.telegram.org/a/",
    );
    expect(vendor.find((desk) => desk.title === "CFPB")?.startUrl).toBe(
      "https://www.consumerfinance.gov/complaint/",
    );
    for (const desk of vendor) {
      expect(desk.startUrl.startsWith("https://"), desk.title).toBe(true);
      expect(desk.startUrl.includes("os.grantandconsultants.com"), desk.title).toBe(false);
      expect(desk.startUrl.includes("/credit/experian"), desk.title).toBe(false);
      expect(desk.startUrl.includes("tab=ghl"), desk.title).toBe(false);
    }
  });
});
