import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getGhlApiConfig, integrationCredentialStatus } from "../src/lib/integrations/credentials";
import { GHL_PRODUCTION_LOCATION_ID } from "../src/lib/integrations/ghl/location";

describe("integration credentials status", () => {
  const keys = [
    "GHL_LOGIN_EMAIL",
    "GHL_LOGIN_PASSWORD",
    "DISPUTEFOX_LOGIN_EMAIL",
    "DISPUTEFOX_LOGIN_PASSWORD",
    "SMARTCREDIT_SPONSOR_URL",
    "GHL_API_KEY",
    "GHL_LOCATION_ID",
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
    expect(status.ghlLive).toBe(false);
    expect(JSON.stringify(status)).not.toContain("secret");
    expect(JSON.stringify(status)).not.toContain("owner@example.com");
  });

  it("requires GHL_API_KEY for live GHL and defaults location to the known Grants id", () => {
    expect(integrationCredentialStatus().ghlLive).toBe(false);
    expect(getGhlApiConfig()).toBeNull();

    process.env.GHL_API_KEY = "pk_test";
    expect(integrationCredentialStatus().ghlLive).toBe(true);
    expect(getGhlApiConfig()?.locationId).toBe(GHL_PRODUCTION_LOCATION_ID);
    expect(integrationCredentialStatus().secretNames).toEqual({
      ghlApiKey: "GHL_API_KEY",
      ghlLocationId: "GHL_LOCATION_ID",
    });

    process.env.GHL_LOCATION_ID = "loc_override";
    expect(getGhlApiConfig()?.locationId).toBe("loc_override");
    expect(JSON.stringify(integrationCredentialStatus())).not.toContain("pk_test");
  });
});
