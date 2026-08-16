import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  assertGhlInboundOnly,
  GHL_CONTACT_WRITES_ENABLED,
  GHL_MESSAGE_WRITES_ENABLED,
  GHL_WORKFLOW_PUBLISH_ENABLED,
  GhlApiError,
  requiredGhlScopeForPath,
} from "../src/lib/integrations/ghl/http";
import {
  GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE,
  GHL_CONVERSATIONS_READONLY_SCOPE,
} from "../src/lib/integrations/ghl/location";

describe("GHL HTTP inbound-only (do not create GHL contacts)", () => {
  it("keeps contact writes, message sends, and workflow publish disabled", () => {
    expect(GHL_CONTACT_WRITES_ENABLED).toBe(false);
    expect(GHL_MESSAGE_WRITES_ENABLED).toBe(false);
    expect(GHL_WORKFLOW_PUBLISH_ENABLED).toBe(false);
  });

  it("allows read paths only", () => {
    expect(() => assertGhlInboundOnly("GET", "/contacts/abc")).not.toThrow();
    expect(() => assertGhlInboundOnly("GET", "/contacts/")).not.toThrow();
    expect(() => assertGhlInboundOnly("POST", "/contacts/search")).not.toThrow();
    expect(() => assertGhlInboundOnly("GET", "/conversations/search")).not.toThrow();
    expect(() => assertGhlInboundOnly("GET", "/conversations/abc/messages")).not.toThrow();
    expect(() => assertGhlInboundOnly("GET", "/conversations/messages/xyz")).not.toThrow();
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

  it("refuses conversation send / write / workflow / A2P paths", () => {
    const writes: Array<[string, string]> = [
      ["POST", "/conversations/messages"],
      ["POST", "/conversations/messages/inbound"],
      ["POST", "/conversations/messages/upload"],
      ["POST", "/conversations/"],
      ["PUT", "/conversations/abc"],
      ["DELETE", "/conversations/abc"],
      ["POST", "/workflows/"],
      ["POST", "/phones/"],
      ["POST", "/a2p/"],
      ["GET", "/sendara/status"],
    ];
    for (const [method, pathName] of writes) {
      expect(() => assertGhlInboundOnly(method, pathName)).toThrow(GhlApiError);
    }
  });

  it("names conversation scopes without widening them from code", () => {
    expect(requiredGhlScopeForPath("/conversations/search")).toBe(GHL_CONVERSATIONS_READONLY_SCOPE);
    expect(requiredGhlScopeForPath("/conversations/abc/messages")).toBe(
      GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE,
    );
    expect(GHL_CONVERSATIONS_READONLY_SCOPE).toBe("conversations.readonly");
    expect(GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE).toBe("conversations/message.readonly");
  });

  it("source module has no GHL contact write or send helpers", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/integrations/ghl/http.ts"), "utf8");
    expect(src).not.toMatch(/createContact|updateContact|deleteContact|upsertContact|createGhlContact/);
    expect(src).not.toMatch(/sendMessage|sendSms|sendEmail|sendIMessage|publishWorkflow/);
    expect(src).toMatch(/Inbound-only GHL client refuses writes/);
    expect(src).toMatch(/refuses outbound send/);
  });
});
