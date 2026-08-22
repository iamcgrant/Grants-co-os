import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loginHref, pathAfterLogin, safeStaffReturnTo } from "@/lib/auth/return-to";

describe("login returnTo", () => {
  it("keeps in-OS staff paths and rejects portals or externals", () => {
    expect(safeStaffReturnTo("/tax/sbtpg")).toBe("/tax/sbtpg");
    expect(safeStaffReturnTo("%2Ftax%2Fsbtpg")).toBe("/tax/sbtpg");
    expect(safeStaffReturnTo("/home")).toBe("/home");
    expect(safeStaffReturnTo("https://pro.sbtpg.com/")).toBeNull();
    expect(safeStaffReturnTo("//pro.sbtpg.com")).toBeNull();
    expect(safeStaffReturnTo("/login")).toBeNull();
    expect(safeStaffReturnTo("/portal")).toBeNull();
    expect(safeStaffReturnTo("/api/auth/login")).toBeNull();
    expect(safeStaffReturnTo(null)).toBeNull();
  });

  it("builds login href and returns staff to the SBTPG desk after sign-in", () => {
    expect(loginHref("/tax/sbtpg")).toBe("/login?returnTo=%2Ftax%2Fsbtpg");
    expect(loginHref("https://evil.example")).toBe("/login");
    expect(pathAfterLogin("OWNER", "/tax/sbtpg")).toBe("/tax/sbtpg");
    expect(pathAfterLogin("ADMIN", null)).toBe("/home");
    expect(pathAfterLogin("CLIENT", "/tax/sbtpg")).toBe("/portal");
    expect(pathAfterLogin("OWNER", null, true)).toBe("/home?gc_shell=app");
    expect(loginHref("/clients?gc_shell=app")).toBe("/login?gc_shell=app&returnTo=%2Fclients");
  });

  it("staff layout and login form preserve returnTo", () => {
    const layout = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/layout.tsx"), "utf8");
    const login = fs.readFileSync(path.join(process.cwd(), "src/app/(auth)/login/page.tsx"), "utf8");
    const form = fs.readFileSync(path.join(process.cwd(), "src/components/auth/LoginForm.tsx"), "utf8");
    const tax = fs.readFileSync(path.join(process.cwd(), "src/lib/tax/access.ts"), "utf8");
    expect(layout).toMatch(/loginHref/);
    expect(layout).toMatch(/x-gc-pathname/);
    expect(login).toMatch(/safeStaffReturnTo/);
    expect(form).toMatch(/pathAfterLogin/);
    expect(form).not.toMatch(/router\.push\("\/home"\)/);
    expect(tax).toMatch(/loginHref/);
  });
});
