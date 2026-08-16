import { describe, it, expect } from "vitest";
import {
  isLiveSyncedIdentifier,
  isSeedIdentifier,
  parseIdentifierMeta,
  getGcEnvironment,
} from "../src/lib/integrations/env";

describe("integration env / identifier metadata", () => {
  it("parses live vs seed metadata", () => {
    expect(
      isLiveSyncedIdentifier(JSON.stringify({ source: "ghl_api", dataPlane: "development" })),
    ).toBe(true);
    expect(isSeedIdentifier(JSON.stringify({ source: "seed", dataPlane: "development" }))).toBe(
      true,
    );
    expect(isSeedIdentifier(null)).toBe(true);
    expect(parseIdentifierMeta("{bad").source).toBeUndefined();
  });

  it("defaults data plane to development", () => {
    const prev = process.env.GC_ENV;
    delete process.env.GC_ENV;
    expect(getGcEnvironment()).toBe("development");
    process.env.GC_ENV = "production";
    expect(getGcEnvironment()).toBe("production");
    if (prev === undefined) delete process.env.GC_ENV;
    else process.env.GC_ENV = prev;
  });
});
