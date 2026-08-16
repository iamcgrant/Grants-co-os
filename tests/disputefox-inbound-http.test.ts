import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  assertDisputeFoxInboundOnly,
  DISPUTEFOX_CLIENT_WRITES_ENABLED,
  DISPUTEFOX_LIVE_LIST_ENABLED,
  DisputeFoxApiError,
} from "../src/lib/integrations/disputefox/http";
import {
  DISPUTEFOX_API_KEY_ENV,
  DISPUTEFOX_ZAP_ENABLED,
  DISPUTEFOX_ZAP_ID,
} from "../src/lib/integrations/disputefox/secrets";

describe("DisputeFox HTTP inbound-only (do not write DF records)", () => {
  it("keeps client writes and live list disabled; Zap stays OFF", () => {
    expect(DISPUTEFOX_CLIENT_WRITES_ENABLED).toBe(false);
    expect(DISPUTEFOX_LIVE_LIST_ENABLED).toBe(false);
    expect(DISPUTEFOX_ZAP_ENABLED).toBe(false);
    expect(DISPUTEFOX_ZAP_ID).toBe("374413762");
    expect(DISPUTEFOX_API_KEY_ENV).toBe("DISPUTEFOX_API_KEY");
  });

  it("refuses create / update / delete client calls", () => {
    const writes: Array<[string, string]> = [
      ["POST", "/clients/"],
      ["POST", "/clients"],
      ["PUT", "/clients/abc"],
      ["PATCH", "/clients/abc"],
      ["DELETE", "/clients/abc"],
    ];
    for (const [method, pathName] of writes) {
      expect(() => assertDisputeFoxInboundOnly(method, pathName)).toThrow(DisputeFoxApiError);
      try {
        assertDisputeFoxInboundOnly(method, pathName);
      } catch (e) {
        expect((e as DisputeFoxApiError).message).toMatch(/refuses writes|create, update, or delete/i);
      }
    }
  });

  it("refuses live GET while list is disabled (Zap stays OFF)", () => {
    expect(() => assertDisputeFoxInboundOnly("GET", "/clients")).toThrow(DisputeFoxApiError);
    try {
      assertDisputeFoxInboundOnly("GET", "/clients");
    } catch (e) {
      expect((e as DisputeFoxApiError).message).toMatch(/374413762|stays OFF/i);
    }
  });

  it("source module has no DisputeFox write helpers", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/lib/integrations/disputefox/http.ts"),
      "utf8",
    );
    expect(src).not.toMatch(
      /createClient|updateClient|deleteClient|upsertClient|createDisputeFox|updateDisputeFox|deleteDisputeFox/,
    );
    expect(src).toMatch(/Inbound-only DisputeFox client refuses writes/);
    expect(src).not.toMatch(/374413762.*true|ZAP_ENABLED = true/);
  });
});
