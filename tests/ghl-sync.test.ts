import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { normalizeEmail, normalizePhone } from "../src/lib/clients/identity";

const testDb = path.join(process.cwd(), "prisma", "test-ghl-sync.db");

describe("GHL → Grants Client inbound sync (existing master records only)", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  let syncGhlContactToGrants: typeof import("../src/lib/integrations/ghl/sync").syncGhlContactToGrants;
  let matchExistingGrantsClient: typeof import("../src/lib/integrations/ghl/sync").matchExistingGrantsClient;
  let pullGhlContacts: typeof import("../src/lib/integrations/ghl/sync").pullGhlContacts;
  let attachExternalIdentifier: typeof import("../src/lib/clients/service").attachExternalIdentifier;

  beforeAll(async () => {
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.GC_ENV = "development";
    delete process.env.GHL_API_KEY;
    delete process.env.GHL_LOCATION_ID;
    execSync("npx prisma db push", {
      env: { ...process.env, DATABASE_URL: `file:${testDb}` },
      stdio: "pipe",
    });

    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;

    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
    const sync = await import("../src/lib/integrations/ghl/sync");
    syncGhlContactToGrants = sync.syncGhlContactToGrants;
    matchExistingGrantsClient = sync.matchExistingGrantsClient;
    pullGhlContacts = sync.pullGhlContacts;
    const clients = await import("../src/lib/clients/service");
    attachExternalIdentifier = clients.attachExternalIdentifier;
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

  async function seedMaster(input: {
    grantsClientId: string;
    email: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    ghlId?: string;
  }) {
    const client = await prisma.client.create({
      data: {
        grantsClientId: input.grantsClientId,
        email: input.email,
        emailNormalized: normalizeEmail(input.email),
        phone: input.phone ?? null,
        phoneNormalized: normalizePhone(input.phone),
        firstName: input.firstName ?? "Test",
        lastName: input.lastName ?? "Client",
      },
    });
    if (input.ghlId) {
      await attachExternalIdentifier({
        clientId: client.id,
        provider: "GHL",
        externalId: input.ghlId,
        metadata: { source: "manual", dataPlane: "development" },
      });
    }
    return client;
  }

  it("matches GHL id before email or phone", async () => {
    const byId = await seedMaster({
      grantsClientId: "GC-000101",
      email: "id-owner@example.com",
      phone: "5551110001",
      firstName: "Id",
      lastName: "Owner",
      ghlId: "ghl_priority",
    });
    await seedMaster({
      grantsClientId: "GC-000102",
      email: "email-owner@example.com",
      phone: "5551110002",
    });

    const match = await matchExistingGrantsClient({
      id: "ghl_priority",
      email: "email-owner@example.com",
      phone: "5551110002",
      firstName: "Other",
      lastName: "Name",
    });
    expect(match.matchedBy).toBe("ghl_id");
    expect(match.client?.id).toBe(byId.id);

    const result = await syncGhlContactToGrants({
      id: "ghl_priority",
      email: "id-owner@example.com",
      phone: "5551110001",
      firstName: "After",
      lastName: "Owner",
    });
    expect(result.action).toBe("UPDATED");
    expect(result.matchedBy).toBe("ghl_id");
    expect(result.grantsClientId).toBe("GC-000101");
    expect(await prisma.client.count()).toBe(2);
  });

  it("matches email when GHL id is unknown", async () => {
    await seedMaster({
      grantsClientId: "GC-000201",
      email: "Same.Person@example.com",
      phone: "5552220001",
    });

    const result = await syncGhlContactToGrants({
      id: "ghl_email_new",
      email: "same.person@example.com",
      phone: "5552229999",
      firstName: "Linked",
      lastName: "ByEmail",
    });
    expect(result.action).toBe("LINKED");
    expect(result.matchedBy).toBe("email");
    expect(result.grantsClientId).toBe("GC-000201");
    expect(await prisma.client.count()).toBe(1);
    expect(
      await prisma.clientIdentifier.count({
        where: { provider: "GHL", externalId: "ghl_email_new" },
      }),
    ).toBe(1);
  });

  it("matches normalized phone when GHL id and email miss", async () => {
    await seedMaster({
      grantsClientId: "GC-000301",
      email: "phone-owner@example.com",
      phone: "(555) 333-0001",
    });

    const result = await syncGhlContactToGrants({
      id: "ghl_phone_new",
      email: "different.inbox@example.com",
      phone: "+1 555 333 0001",
      firstName: "Linked",
      lastName: "ByPhone",
    });
    expect(result.action).toBe("LINKED");
    expect(result.matchedBy).toBe("phone");
    expect(result.grantsClientId).toBe("GC-000301");
    expect(await prisma.client.count()).toBe(1);
  });

  it("prefers email over phone when they point at different clients", async () => {
    await seedMaster({
      grantsClientId: "GC-000401",
      email: "email-wins@example.com",
      phone: "5554440001",
    });
    await seedMaster({
      grantsClientId: "GC-000402",
      email: "phone-loses@example.com",
      phone: "5554440002",
    });

    const result = await syncGhlContactToGrants({
      id: "ghl_order",
      email: "email-wins@example.com",
      phone: "5554440002",
      firstName: "Order",
      lastName: "Test",
    });
    expect(result.matchedBy).toBe("email");
    expect(result.grantsClientId).toBe("GC-000401");
    expect(await prisma.client.count()).toBe(2);
  });

  it("does not create a Grants Client when nothing matches", async () => {
    await seedMaster({
      grantsClientId: "GC-000501",
      email: "existing@example.com",
      phone: "5555550001",
    });

    const result = await syncGhlContactToGrants({
      id: "ghl_unknown",
      email: "brand.new@example.com",
      phone: "5555559999",
      firstName: "Brand",
      lastName: "New",
    });
    expect(result.action).toBe("SKIPPED_NO_MATCH");
    expect(result.grantsClientId).toBeUndefined();
    expect(await prisma.client.count()).toBe(1);
    expect(await prisma.clientIdentifier.count({ where: { provider: "GHL" } })).toBe(0);
  });

  it("does not create GHL contacts (local upsert never calls fetch)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await seedMaster({
      grantsClientId: "GC-000601",
      email: "nofetch@example.com",
    });
    await syncGhlContactToGrants({
      id: "ghl_local",
      email: "nofetch@example.com",
      firstName: "No",
      lastName: "Fetch",
    });
    await syncGhlContactToGrants({
      id: "ghl_unmatched",
      email: "nobody@example.com",
      firstName: "Skip",
      lastName: "Me",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("dry-run reports a match without writing identifiers or names", async () => {
    const client = await seedMaster({
      grantsClientId: "GC-000701",
      email: "dry@example.com",
      firstName: "Before",
      lastName: "Dry",
    });

    const result = await syncGhlContactToGrants(
      {
        id: "ghl_dry",
        email: "dry@example.com",
        firstName: "After",
        lastName: "Dry",
      },
      undefined,
      { dryRun: true },
    );
    expect(result.action).toBe("LINKED");
    expect(result.dryRun).toBe(true);
    expect(result.matchedBy).toBe("email");
    expect(await prisma.clientIdentifier.count()).toBe(0);
    const unchanged = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(unchanged.firstName).toBe("Before");
  });

  it("fails closed without GHL_API_KEY and does not call GHL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    delete process.env.GHL_API_KEY;
    const pull = await pullGhlContacts({ dryRun: true, limit: 5 });
    expect(pull.ready).toBe(false);
    expect(pull.failedClosed).toBe(true);
    expect(pull.requiredSecrets).toEqual(["GHL_API_KEY"]);
    expect(pull.optionalSecrets).toEqual(["GHL_LOCATION_ID"]);
    expect(pull.defaultLocationId).toBe("NsmlbLVNr4SBJNC8gnrn");
    expect(pull.results).toEqual([]);
    expect(JSON.stringify(pull)).not.toMatch(/pit-|sk_|Bearer /i);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("skips ambiguous phone matches instead of creating or linking the wrong record", async () => {
    await seedMaster({
      grantsClientId: "GC-000801",
      email: "one@example.com",
      phone: "5558880001",
    });
    await seedMaster({
      grantsClientId: "GC-000802",
      email: "two@example.com",
      phone: "5558880001",
    });

    const result = await syncGhlContactToGrants({
      id: "ghl_ambiguous",
      email: "other@example.com",
      phone: "5558880001",
      firstName: "Ambiguous",
      lastName: "Phone",
    });
    expect(result.action).toBe("SKIPPED_AMBIGUOUS");
    expect(await prisma.client.count()).toBe(2);
    expect(await prisma.clientIdentifier.count()).toBe(0);
  });
});
