import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";

const testDb = path.join(process.cwd(), "prisma", "test-ghl-sync.db");

describe("GHL → Grants Client sync (no duplicates)", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  let syncGhlContactToGrants: typeof import("../src/lib/integrations/ghl/sync").syncGhlContactToGrants;

  beforeAll(async () => {
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.GC_ENV = "development";
    execSync("npx prisma db push", {
      env: { ...process.env, DATABASE_URL: `file:${testDb}` },
      stdio: "pipe",
    });

    // Ensure app prisma singleton binds to this test DB
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;

    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
    const sync = await import("../src/lib/integrations/ghl/sync");
    syncGhlContactToGrants = sync.syncGhlContactToGrants;
  });

  beforeEach(async () => {
    await prisma.integrationSyncEvent.deleteMany();
    await prisma.clientTimelineEvent.deleteMany();
    await prisma.auditLog.deleteMany().catch(() => undefined);
    await prisma.clientIdentifier.deleteMany();
    await prisma.client.deleteMany();
    await prisma.integrationConnection.deleteMany();
    await prisma.idSequence.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it("creates a Grants Client from a GHL contact", async () => {
    const result = await syncGhlContactToGrants({
      id: "ghl_live_001",
      email: "real.client@example.com",
      phone: "5551112222",
      firstName: "Real",
      lastName: "Client",
      tags: ["lead"],
    });
    expect(result.action).toBe("CREATED");
    expect(result.grantsClientId).toMatch(/^GC-\d{6}$/);

    const count = await prisma.client.count({
      where: { emailNormalized: "real.client@example.com" },
    });
    expect(count).toBe(1);

    const ident = await prisma.clientIdentifier.findUnique({
      where: { provider_externalId: { provider: "GHL", externalId: "ghl_live_001" } },
    });
    expect(ident?.metadataJson).toContain("ghl_api");
  });

  it("links by email instead of creating a duplicate", async () => {
    await syncGhlContactToGrants({
      id: "ghl_a",
      email: "same@example.com",
      firstName: "Sam",
      lastName: "One",
      phone: "5550001111",
    });
    const second = await syncGhlContactToGrants({
      id: "ghl_b",
      email: "same@example.com",
      firstName: "Sam",
      lastName: "Two",
      phone: "5550002222",
    });
    expect(second.action).toBe("LINKED");
    expect(await prisma.client.count({ where: { emailNormalized: "same@example.com" } })).toBe(1);
    expect(await prisma.clientIdentifier.count({ where: { provider: "GHL" } })).toBe(2);
  });

  it("updates existing GHL-linked client without duplicating", async () => {
    const first = await syncGhlContactToGrants({
      id: "ghl_same",
      email: "update.me@example.com",
      firstName: "Before",
      lastName: "Name",
    });
    const second = await syncGhlContactToGrants({
      id: "ghl_same",
      email: "update.me@example.com",
      firstName: "After",
      lastName: "Name",
    });
    expect(first.action).toBe("CREATED");
    expect(second.action).toBe("UPDATED");
    expect(second.grantsClientId).toBe(first.grantsClientId);
    expect(await prisma.client.count()).toBe(1);
    const client = await prisma.client.findFirst({
      where: { emailNormalized: "update.me@example.com" },
    });
    expect(client?.firstName).toBe("After");
  });

  it("skips contacts without email", async () => {
    const result = await syncGhlContactToGrants({
      id: "ghl_no_email",
      firstName: "No",
      lastName: "Email",
      phone: "5559998888",
    });
    expect(result.action).toBe("SKIPPED_NO_EMAIL");
    expect(await prisma.client.count()).toBe(0);
  });
});
