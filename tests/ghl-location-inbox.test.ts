import { afterEach, describe, expect, it, vi } from "vitest";
import { listGhlLocationInbox, summarizeGhlLocationInbox } from "@/lib/integrations/ghl/conversations";

describe("GHL location inbox list", () => {
  afterEach(() => {
    delete process.env.GHL_API_KEY;
    delete process.env.GHL_LOCATION_ID;
    vi.restoreAllMocks();
  });

  it("fails closed without GHL_API_KEY and does not call LeadConnector", async () => {
    const fetchImpl = vi.spyOn(globalThis, "fetch");
    const inbox = await listGhlLocationInbox();
    const summary = await summarizeGhlLocationInbox();
    expect(inbox.ready).toBe(false);
    expect(inbox.failedClosed).toBe(true);
    expect(inbox.message).toMatch(/GHL_API_KEY/);
    expect(summary.conversations).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
