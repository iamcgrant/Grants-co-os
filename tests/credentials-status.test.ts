import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { integrationCredentialStatus } from "../src/lib/integrations/credentials";

describe("integration credentials status", () => {
  const keys = [
    "GHL_LOGIN_EMAIL",
    "GHL_LOGIN_PASSWORD",
    "DISPUTEFOX_LOGIN_EMAIL",
    "DISPUTEFOX_LOGIN_PASSWORD",
    "SMARTCREDIT_SPONSOR_URL",
  ] as const;
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of keys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it("reports booleans only when credentials are set", () => {
    expect(integrationCredentialStatus().ghlPortal).toBe(false);
    process.env.GHL_LOGIN_EMAIL = "owner@example.com";
    process.env.GHL_LOGIN_PASSWORD = "secret";
    const status = integrationCredentialStatus();
    expect(status.ghlPortal).toBe(true);
    expect(JSON.stringify(status)).not.toContain("secret");
    expect(JSON.stringify(status)).not.toContain("owner@example.com");
  });
});
