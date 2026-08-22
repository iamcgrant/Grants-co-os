import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SESSION_DAYS_BRIEF, SESSION_DAYS_REMEMBER } from "@/lib/auth/session";

describe("stay signed in", () => {
  it("keeps a long OS session cookie when staff stay signed in", () => {
    expect(SESSION_DAYS_REMEMBER).toBe(90);
    expect(SESSION_DAYS_BRIEF).toBe(14);
    const session = fs.readFileSync(path.join(process.cwd(), "src/lib/auth/session.ts"), "utf8");
    expect(session).toMatch(/rememberMe === false \? SESSION_DAYS_BRIEF : SESSION_DAYS_REMEMBER/);
    const login = fs.readFileSync(path.join(process.cwd(), "src/app/api/auth/login/route.ts"), "utf8");
    expect(login).toMatch(/rememberMe: z\.boolean\(\)\.optional\(\)\.default\(true\)/);
    expect(login).toMatch(/rememberMe: body\.rememberMe/);
    const form = fs.readFileSync(path.join(process.cwd(), "src/components/auth/LoginForm.tsx"), "utf8");
    expect(form).toMatch(/Stay signed in/);
    expect(form).toMatch(/rememberMe/);
  });

  it("keeps portal desks on the shared browser profile so vendor cookies persist", () => {
    const desk = fs.readFileSync(path.join(process.cwd(), "src/components/desk/PortalDesk.tsx"), "utf8");
    expect(desk).toMatch(/data-browser-profile="shared"/);
    expect(desk).not.toMatch(/sandbox=/);
    expect(desk).not.toMatch(/credentialless/);
    expect(desk).not.toMatch(/target="_self"/);
    expect(desk).not.toMatch(/window\.location|location\.assign/);
    expect(desk).toMatch(/target="_blank"/);
    expect(desk).toMatch(/Open in browser/);
    expect(desk).not.toMatch(/refuses an in-desk embed/);
    expect(desk).not.toMatch(/PortalContinue|data-portal-continue/);
    expect(desk).toMatch(/portalDeskCanEmbed|data-embed-policy/);
  });
});
