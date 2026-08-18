import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getGhlOutboundAdapter,
  sendGhlOutboundMessage,
  probeGhlOutboundSendScope,
} from "../src/lib/integrations/ghl/outbound";
import {
  GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE,
  GHL_CONVERSATIONS_WRITE_SCOPE,
} from "../src/lib/integrations/ghl/location";

const originalFetch = globalThis.fetch;

describe("GHL outbound SMS/email adapter", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    delete process.env.GHL_API_KEY;
    delete process.env.GHL_LOCATION_ID;
  });

  it("names required write scopes without widening from code", () => {
    const adapter = getGhlOutboundAdapter();
    expect(adapter.requiredScope).toBe(GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE);
    expect(adapter.additionalScopesNeeded).toContain(GHL_CONVERSATIONS_WRITE_SCOPE);
    expect(GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE).toBe("conversations/message.write");
  });

  it("fails closed without GHL_API_KEY and does not call fetch", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendGhlOutboundMessage({
      channel: "SMS",
      ghlContactId: "contact_1",
      body: "hello",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("ACTION_REQUIRED");
      expect(result.requiredScope).toBe(GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE);
      expect(result.reason).toMatch(/GHL_API_KEY/);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns ACTION_REQUIRED when PIT lacks conversations/message.write", async () => {
    process.env.GHL_API_KEY = "test_key_not_real";
    process.env.GHL_LOCATION_ID = "loc_test";

    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ statusCode: 401, message: "The token is not authorized for this scope." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    const result = await sendGhlOutboundMessage({
      channel: "Email",
      ghlContactId: "contact_1",
      body: "hello",
      subject: "Hi",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("ACTION_REQUIRED");
      expect(result.httpStatus).toBe(401);
      expect(result.requiredScope).toBe("conversations/message.write");
      expect(result.reason).toMatch(/conversations\/message\.write/);
    }
  });

  it("succeeds when provider returns a message id", async () => {
    process.env.GHL_API_KEY = "test_key_not_real";
    process.env.GHL_LOCATION_ID = "loc_test";

    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ messageId: "msg_123", conversationId: "conv_1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    const result = await sendGhlOutboundMessage({
      channel: "SMS",
      ghlContactId: "contact_1",
      body: "hello",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("SENT");
      expect(result.providerMessageId).toBe("msg_123");
      expect(result.conversationId).toBe("conv_1");
    }

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(call[0])).toContain("/conversations/messages");
    const init = call[1] as RequestInit;
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ type: "SMS", contactId: "contact_1", message: "hello" });
  });

  it("probe reports ACTION_REQUIRED on scope 401", async () => {
    process.env.GHL_API_KEY = "test_key_not_real";
    process.env.GHL_LOCATION_ID = "loc_test";

    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ statusCode: 401, message: "The token is not authorized for this scope." }), {
        status: 401,
      }),
    ) as unknown as typeof fetch;

    const probe = await probeGhlOutboundSendScope();
    expect(probe.ready).toBe(false);
    expect(probe.status).toBe("ACTION_REQUIRED");
    expect(probe.requiredScope).toBe(GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE);
    expect(probe.httpStatus).toBe(401);
  });

  it("keeps inbound http.ts free of send helpers", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const http = fs.readFileSync(path.join(process.cwd(), "src/lib/integrations/ghl/http.ts"), "utf8");
    const outbound = fs.readFileSync(path.join(process.cwd(), "src/lib/integrations/ghl/outbound.ts"), "utf8");
    expect(http).not.toMatch(/sendGhlOutboundMessage|sendSms|sendEmail/);
    expect(outbound).toMatch(/conversations\/message\.write/);
    expect(outbound).toMatch(/ACTION_REQUIRED/);
  });
});
