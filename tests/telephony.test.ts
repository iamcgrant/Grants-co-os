import { afterEach, describe, expect, it } from "vitest";
import { presentIncomingCall, getTelephonyProvider } from "@/lib/communications/telephony";

describe("telephony adapter honesty", () => {
  const prevGhlKey = process.env.GHL_API_KEY;

  afterEach(() => {
    if (prevGhlKey === undefined) delete process.env.GHL_API_KEY;
    else process.env.GHL_API_KEY = prevGhlKey;
  });

  it("exposes an in-OS dialer and fails closed without a GHL voice session", async () => {
    delete process.env.GHL_API_KEY;
    const provider = getTelephonyProvider();
    expect(provider.capabilities().browserDialer).toBe(true);
    const started = await provider.startOutboundSession({
      toE164: "+15551234567",
      staffUserId: "staff_1",
    });
    expect(started.ok).toBe(false);
    if (!started.ok) {
      expect(started.reason).toMatch(/GHL_API_KEY|phone-system|voice/i);
    }
  });

  it("presents master client on inbound screen-pop", () => {
    const view = presentIncomingCall({
      fromE164: "+15551234567",
      client: {
        id: "c1",
        grantsClientId: "GC-000001",
        firstName: "Donna",
        lastName: "James",
        status: "ACTIVE",
        stage: "ONBOARDING",
        assignments: [
          {
            roleLabel: "CUSTOMER_SERVICE",
            staff: { firstName: "Simon", lastName: "Young" },
          },
        ],
        clientServices: [{ service: { name: "Credit Optimization" } }],
      },
    });
    expect(view.displayName).toBe("Donna James");
    expect(view.assignedStaff).toBe("Simon Young");
    expect(view.serviceName).toBe("Credit Optimization");
  });
});
