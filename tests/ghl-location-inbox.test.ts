import path from "node:path";
import fs from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";

const testDb = path.join(process.cwd(), "prisma", "test-ghl-location-inbox.db");

describe("GHL location inbox list", () => {
  let listGhlLocationInbox: typeof import("../src/lib/integrations/ghl/conversations").listGhlLocationInbox;
  let summarizeGhlLocationInbox: typeof import("../src/lib/integrations/ghl/conversations").summarizeGhlLocationInbox;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${testDb}`;
    delete process.env.GHL_API_KEY;
    delete process.env.GHL_LOCATION_ID;
    resetSqliteFromSchema(testDb);
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    vi.resetModules();
    const conv = await import("../src/lib/integrations/ghl/conversations");
    listGhlLocationInbox = conv.listGhlLocationInbox;
    summarizeGhlLocationInbox = conv.summarizeGhlLocationInbox;
  });

  afterEach(() => {
    delete process.env.GHL_API_KEY;
    delete process.env.GHL_LOCATION_ID;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
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
