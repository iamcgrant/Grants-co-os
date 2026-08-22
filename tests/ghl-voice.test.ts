import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { probeGhlVoicePath, startGhlOutboundCall } from "../src/lib/integrations/ghl/voice";
import { GHL_PHONE_SYSTEM_READONLY_SCOPE, GHL_VOICE_SESSION_SCOPE } from "../src/lib/integrations/ghl/location";

const originalFetch = globalThis.fetch;

describe("GHL voice / in-OS dialer", () => {
  beforeEach(() => {
    delete process.env.GHL_API_KEY;
    delete process.env.GHL_LOCATION_ID;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    delete process.env.GHL_API_KEY;
    delete process.env.GHL_LOCATION_ID;
  });

  it("fails closed without GHL_API_KEY", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const probe = await probeGhlVoicePath();
    expect(probe.ready).toBe(false);
    expect(probe.status).toBe("ACTION_REQUIRED");
    expect(probe.requiredSecrets).toContain("GHL_API_KEY");
    expect(probe.requiredScope).toBe(GHL_PHONE_SYSTEM_READONLY_SCOPE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("names missing phone-system scope on 401", async () => {
    process.env.GHL_API_KEY = "test_key_not_real";
    process.env.GHL_LOCATION_ID = "loc_test";
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "The token is not authorized for this scope." }), {
        status: 401,
      }),
    ) as unknown as typeof fetch;

    const probe = await probeGhlVoicePath();
    expect(probe.ready).toBe(false);
    expect(probe.status).toBe("ACTION_REQUIRED");
    expect(probe.requiredScope).toBe(GHL_PHONE_SYSTEM_READONLY_SCOPE);
    expect(probe.message).toMatch(/phone-system\.readonly/);
  });

  it("stays ACTION_REQUIRED when numbers exist but voice session is unauthorized", async () => {
    process.env.GHL_API_KEY = "test_key_not_real";
    process.env.GHL_LOCATION_ID = "loc_test";
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/phone-system/numbers")) {
        return new Response(JSON.stringify({ numbers: [{ id: "n1", phone: "+15551234567" }] }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ message: "The token is not authorized for this scope." }), {
        status: 401,
      });
    }) as unknown as typeof fetch;

    const probe = await probeGhlVoicePath();
    expect(probe.numbers).toHaveLength(1);
    expect(probe.ready).toBe(false);
    expect(probe.requiredScope).toBe(GHL_VOICE_SESSION_SCOPE);
  });

  it("is CONNECTED only after numbers + session probes succeed", async () => {
    process.env.GHL_API_KEY = "test_key_not_real";
    process.env.GHL_LOCATION_ID = "loc_test";
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ numbers: [{ id: "n1", phone: "+15551234567" }] }), {
        status: 200,
      }),
    ) as unknown as typeof fetch;

    const probe = await probeGhlVoicePath();
    expect(probe.ready).toBe(true);
    expect(probe.status).toBe("CONNECTED");
    expect(probe.sessionReady).toBe(true);
  });

  it("refuses to start a call when the session probe is not ready", async () => {
    const started = await startGhlOutboundCall({
      toE164: "+15557654321",
      staffUserId: "staff_1",
    });
    expect(started.ok).toBe(false);
    if (!started.ok) {
      expect(started.reason).toMatch(/GHL_API_KEY/);
    }
  });
});
