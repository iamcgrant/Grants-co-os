import { describe, expect, it } from "vitest";
import { presentIncomingCall, getTelephonyProvider } from "@/lib/communications/telephony";

describe("telephony adapter honesty", () => {
  it("does not claim browser dialer when unsupported", () => {
    const provider = getTelephonyProvider();
    expect(provider.capabilities().browserDialer).toBe(false);
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
