import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  assertGhlInboundOnly,
  GHL_CONTACT_WRITES_ENABLED,
  GhlApiError,
} from "../src/lib/integrations/ghl/http";

describe("GHL HTTP inbound-only (do not create GHL contacts)", () => {
  it("keeps contact writes disabled", () => {
    expect(GHL_CONTACT_WRITES_ENABLED).toBe(false);
  });

  it("allows read paths only", () => {
    expect(() => assertGhlInboundOnly("GET", "/contacts/abc")).not.toThrow();
    expect(() => assertGhlInboundOnly("GET", "/contacts/")).not.toThrow();
    expect(() => assertGhlInboundOnly("POST", "/contacts/search")).not.toThrow();
  });

  it("refuses create / update / delete contact calls", () => {
    const writes: Array<[string, string]> = [
      ["POST", "/contacts/"],
      ["POST", "/contacts"],
      ["PUT", "/contacts/abc"],
      ["PATCH", "/contacts/abc"],
      ["DELETE", "/contacts/abc"],
      ["POST", "https://services.leadconnectorhq.com/contacts/"],
    ];
    for (const [method, pathName] of writes) {
      expect(() => assertGhlInboundOnly(method, pathName)).toThrow(GhlApiError);
      try {
        assertGhlInboundOnly(method, pathName);
      } catch (e) {
        expect((e as GhlApiError).message).toMatch(/refuses writes|create, update, or delete/i);
      }
    }
  });

  it("source module has no GHL contact write helpers", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/integrations/ghl/http.ts"), "utf8");
    expect(src).not.toMatch(/createContact|updateContact|deleteContact|upsertContact|createGhlContact/);
    expect(src).toMatch(/Inbound-only GHL client refuses writes/);
  });
});
