import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";
import { CONFIRMED_MASTERS } from "../src/lib/clients/confirmed-masters";
import {
  CONFIRMED_DF_ROSTER,
  CONFIRMED_DF_RECON_TAG,
  parseDfStageLabel,
  resolveConfirmedIdentityEmail,
} from "../src/lib/integrations/disputefox/roster";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

const testDb = path.join(process.cwd(), "prisma", "test-disputefox-sync.db");

describe("DisputeFox → Grants Client inbound attach (existing master records only)", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  let syncDisputeFoxClientToGrants: typeof import("../src/lib/integrations/disputefox/sync").syncDisputeFoxClientToGrants;
  let matchExistingGrantsClientForDf: typeof import("../src/lib/integrations/disputefox/sync").matchExistingGrantsClientForDf;
  let pullDisputeFoxClients: typeof import("../src/lib/integrations/disputefox/sync").pullDisputeFoxClients;
  let attachConfirmedDfRoster: typeof import("../src/lib/integrations/disputefox/sync").attachConfirmedDfRoster;
  let importConfirmedMasters: typeof import("../src/lib/clients/import-confirmed-masters").importConfirmedMasters;
  let attachExternalIdentifier: typeof import("../src/lib/clients/service").attachExternalIdentifier;

  const prevGhlKey = process.env.GHL_API_KEY;
  const prevDfKey = process.env.DISPUTEFOX_API_KEY;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.GC_ENV = "development";
    delete process.env.DISPUTEFOX_API_KEY;
    delete process.env.GHL_API_KEY;
    resetSqliteFromSchema(testDb);

    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;

    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
    const sync = await import("../src/lib/integrations/disputefox/sync");
    syncDisputeFoxClientToGrants = sync.syncDisputeFoxClientToGrants;
    matchExistingGrantsClientForDf = sync.matchExistingGrantsClientForDf;
    pullDisputeFoxClients = sync.pullDisputeFoxClients;
    attachConfirmedDfRoster = sync.attachConfirmedDfRoster;
    const importers = await import("../src/lib/clients/import-confirmed-masters");
    importConfirmedMasters = importers.importConfirmedMasters;
    const clients = await import("../src/lib/clients/service");
    attachExternalIdentifier = clients.attachExternalIdentifier;
  });

  beforeEach(async () => {
    await prisma.integrationSyncEvent.deleteMany();
    await prisma.clientTimelineEvent.deleteMany();
    await prisma.auditLog.deleteMany().catch(() => undefined);
    await prisma.disputeRound.deleteMany();
    await prisma.clientIdentifier.deleteMany();
    await prisma.client.deleteMany();
    await prisma.integrationConnection.deleteMany();
    await prisma.idSequence.deleteMany();
    delete process.env.DISPUTEFOX_API_KEY;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    if (prevGhlKey === undefined) delete process.env.GHL_API_KEY;
    else process.env.GHL_API_KEY = prevGhlKey;
    if (prevDfKey === undefined) delete process.env.DISPUTEFOX_API_KEY;
    else process.env.DISPUTEFOX_API_KEY = prevDfKey;
  });

  async function seedMaster(input: {
    grantsClientId: string;
    email: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    dfId?: string;
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
    if (input.dfId) {
      await attachExternalIdentifier({
        clientId: client.id,
        provider: "DISPUTEFOX",
        externalId: input.dfId,
        metadata: { source: "disputefox_api", dataPlane: "development" },
      });
    }
    return client;
  }

  it("roster is exactly the same 26 identity emails as confirmed masters", () => {
    expect(CONFIRMED_DF_ROSTER).toHaveLength(26);
    expect(CONFIRMED_MASTERS).toHaveLength(26);
    const masterEmails = CONFIRMED_MASTERS.map((r) => normalizeEmail(r.email)).sort();
    const dfEmails = CONFIRMED_DF_ROSTER.map((r) => normalizeEmail(r.email)).sort();
    expect(dfEmails).toEqual(masterEmails);
    expect(new Set(dfEmails).size).toBe(26);
    expect(CONFIRMED_DF_ROSTER.every((r) => r.started === true)).toBe(true);
    expect(CONFIRMED_DF_ROSTER.every((r) => parseDfStageLabel(r.dfStageLabel))).toBeTruthy();
    expect(CONFIRMED_DF_ROSTER.every((r) => !("id" in r) && !("dfId" in r))).toBe(true);
  });

  it("maps Kimberly DF inbox to the same identity email (one human)", () => {
    expect(resolveConfirmedIdentityEmail("KimberlyBr490@gmail.com")).toBe("kskymommy09@icloud.com");
    expect(resolveConfirmedIdentityEmail("kskymommy09@icloud.com")).toBe("kskymommy09@icloud.com");
  });

  it("matches email before phone when they point at different clients", async () => {
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

    const result = await syncDisputeFoxClientToGrants({
      email: "email-wins@example.com",
      phone: "5554440002",
      stage: "Round 1 Sent",
      started: true,
    });
    expect(result.matchedBy).toBe("email");
    expect(result.grantsClientId).toBe("GC-000401");
    expect(result.inventedDfId).toBe(false);
    expect(await prisma.client.count()).toBe(2);
  });

  it("matches normalized phone when email misses", async () => {
    await seedMaster({
      grantsClientId: "GC-000301",
      email: "phone-owner@example.com",
      phone: "(555) 333-0001",
    });

    const result = await syncDisputeFoxClientToGrants({
      email: "different.inbox@example.com",
      phone: "+1 555 333 0001",
      stage: "Round 2 Ready",
      started: true,
    });
    expect(result.action).toBe("LINKED");
    expect(result.matchedBy).toBe("phone");
    expect(result.grantsClientId).toBe("GC-000301");
    expect(await prisma.client.count()).toBe(1);
    expect(await prisma.clientIdentifier.count({ where: { provider: "DISPUTEFOX" } })).toBe(0);
  });

  it("does not create a Grants Client when nothing matches", async () => {
    await seedMaster({
      grantsClientId: "GC-000501",
      email: "existing@example.com",
      phone: "5555550001",
    });

    const result = await syncDisputeFoxClientToGrants({
      email: "brand.new@example.com",
      phone: "5555559999",
      stage: "Round 1 Sent",
      started: true,
    });
    expect(result.action).toBe("SKIPPED_NO_MATCH");
    expect(result.grantsClientId).toBeUndefined();
    expect(await prisma.client.count()).toBe(1);
    expect(await prisma.clientIdentifier.count({ where: { provider: "DISPUTEFOX" } })).toBe(0);
  });

  it("does not invent a DF id and does not call fetch on local upsert", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await seedMaster({
      grantsClientId: "GC-000601",
      email: "nofetch@example.com",
    });
    const result = await syncDisputeFoxClientToGrants({
      email: "nofetch@example.com",
      stage: "Round 1 Sent",
      started: true,
    });
    expect(result.inventedDfId).toBe(false);
    expect(result.disputeFoxClientId).toBeUndefined();
    expect(await prisma.clientIdentifier.count({ where: { provider: "DISPUTEFOX" } })).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("attaches a provided live DF id without creating a second client", async () => {
    await seedMaster({
      grantsClientId: "GC-000201",
      email: "Same.Person@example.com",
    });

    const result = await syncDisputeFoxClientToGrants({
      id: "88421",
      email: "same.person@example.com",
      stage: "Round 2 Sent",
      started: true,
    });
    expect(result.action).toBe("LINKED");
    expect(result.matchedBy).toBe("email");
    expect(result.disputeFoxClientId).toBe("88421");
    expect(await prisma.client.count()).toBe(1);
    expect(
      await prisma.clientIdentifier.count({
        where: { provider: "DISPUTEFOX", externalId: "88421" },
      }),
    ).toBe(1);
  });

  it("matches existing DF id before email or phone", async () => {
    const byId = await seedMaster({
      grantsClientId: "GC-000101",
      email: "id-owner@example.com",
      phone: "5551110001",
      dfId: "99100",
    });
    await seedMaster({
      grantsClientId: "GC-000102",
      email: "email-owner@example.com",
      phone: "5551110002",
    });

    const match = await matchExistingGrantsClientForDf({
      id: "99100",
      email: "email-owner@example.com",
      phone: "5551110002",
    });
    expect(match.matchedBy).toBe("df_id");
    expect(match.client?.id).toBe(byId.id);
    expect(await prisma.client.count()).toBe(2);
  });

  it("dry-run reports a match without writing stage or rounds", async () => {
    const client = await seedMaster({
      grantsClientId: "GC-000701",
      email: "dry@example.com",
      firstName: "Before",
      lastName: "Dry",
    });

    const result = await syncDisputeFoxClientToGrants(
      {
        email: "dry@example.com",
        stage: "Round 3 Ready",
        started: true,
      },
      undefined,
      { dryRun: true },
    );
    expect(result.action).toBe("LINKED");
    expect(result.dryRun).toBe(true);
    expect(await prisma.disputeRound.count()).toBe(0);
    const unchanged = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(unchanged.stage).toBe("NEW_ENROLLMENT");
    expect(unchanged.firstName).toBe("Before");
  });

  it("fails closed without DISPUTEFOX_API_KEY and does not call DisputeFox or GHL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    delete process.env.DISPUTEFOX_API_KEY;
    const pull = await pullDisputeFoxClients({ dryRun: true });
    expect(pull.ready).toBe(false);
    expect(pull.failedClosed).toBe(true);
    expect(pull.requiredSecrets).toEqual(["DISPUTEFOX_API_KEY"]);
    expect(pull.zapEnabled).toBe(false);
    expect(pull.zapId).toBe("374413762");
    expect(pull.results).toEqual([]);
    expect(JSON.stringify(pull)).not.toMatch(/pit-|sk_|Bearer /i);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("Kimberly DF email attaches to the icloud master — no second record", async () => {
    await seedMaster({
      grantsClientId: "GC-000901",
      email: "kskymommy09@icloud.com",
      firstName: "Kimberly",
      lastName: "Britt",
    });

    const result = await syncDisputeFoxClientToGrants({
      email: "KimberlyBr490@gmail.com",
      stage: "Round 1 Sent",
      started: true,
    });
    expect(result.action).toBe("LINKED");
    expect(result.matchedBy).toBe("email");
    expect(await prisma.client.count()).toBe(1);
    const kept = await prisma.client.findUniqueOrThrow({
      where: { emailNormalized: "kskymommy09@icloud.com" },
    });
    expect(kept.grantsClientId).toBe("GC-000901");
    expect(kept.stage).toBe("ROUND_SUBMITTED");
    expect(
      await prisma.client.findUnique({
        where: { emailNormalized: "kimberlybr490@gmail.com" },
      }),
    ).toBeNull();
    expect(await prisma.clientIdentifier.count({ where: { provider: "DISPUTEFOX" } })).toBe(0);
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

    const result = await syncDisputeFoxClientToGrants({
      email: "other@example.com",
      phone: "5558880001",
      stage: "Round 1 Sent",
      started: true,
    });
    expect(result.action).toBe("SKIPPED_AMBIGUOUS");
    expect(await prisma.client.count()).toBe(2);
    expect(await prisma.disputeRound.count()).toBe(0);
  });

  it("local roster attach is idempotent on the 26 masters and invents no DF ids", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const imported = await importConfirmedMasters();
    expect(imported.created).toBe(26);

    const first = await attachConfirmedDfRoster();
    expect(first.roster).toBe(26);
    expect(first.attached).toBe(26);
    expect(first.skipped).toBe(0);
    expect(first.inventedDfIds).toBe(0);
    expect(first.zapEnabled).toBe(false);
    expect(await prisma.client.count()).toBe(26);
    expect(await prisma.clientIdentifier.count({ where: { provider: "DISPUTEFOX" } })).toBe(0);
    expect(await prisma.disputeRound.count()).toBe(26);

    const elijah = await prisma.client.findUniqueOrThrow({
      where: { emailNormalized: "dunhamelijah@gmail.com" },
    });
    expect(elijah.stage).toBe("NEXT_ROUND");
    expect(elijah.nextAction).toBe("Send Round 3");
    expect(elijah.nextActionOwner).toBe("JONA");
    const elijahRound = await prisma.disputeRound.findUniqueOrThrow({
      where: { clientId_roundNumber: { clientId: elijah.id, roundNumber: 3 } },
    });
    expect(elijahRound.status).toBe("READY");
    expect(elijahRound.notes).toContain(CONFIRMED_DF_RECON_TAG);

    const second = await attachConfirmedDfRoster();
    expect(second.attached).toBe(0);
    expect(second.unchanged).toBe(26);
    expect(await prisma.client.count()).toBe(26);
    expect(await prisma.disputeRound.count()).toBe(26);
    expect(await prisma.clientIdentifier.count({ where: { provider: "DISPUTEFOX" } })).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("local attach does not create masters that were never imported", async () => {
    const result = await attachConfirmedDfRoster();
    expect(result.attached).toBe(0);
    expect(result.skipped).toBe(26);
    expect(await prisma.client.count()).toBe(0);
  });

  it("live pull with a key still does not fetch or write (Zap stays OFF)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    process.env.DISPUTEFOX_API_KEY = "present-but-must-not-be-logged";
    await seedMaster({
      grantsClientId: "GC-001001",
      email: "prettystrongyeg@gmail.com",
    });
    const pull = await pullDisputeFoxClients({ dryRun: false });
    expect(pull.ready).toBe(true);
    expect(pull.failedClosed).toBeUndefined();
    expect(pull.fetched).toBe(0);
    expect(pull.liveListEnabled).toBe(false);
    expect(pull.zapEnabled).toBe(false);
    expect(JSON.stringify(pull)).not.toContain("present-but-must-not-be-logged");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await prisma.clientIdentifier.count({ where: { provider: "DISPUTEFOX" } })).toBe(0);
    fetchSpy.mockRestore();
    delete process.env.DISPUTEFOX_API_KEY;
  });
});
