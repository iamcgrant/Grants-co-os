import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";
import { CONFIRMED_MASTERS } from "../src/lib/clients/confirmed-masters";
import { CRC_API_KEY_ENV, CRC_RECOVERY_WRITES_ENV } from "../src/lib/integrations/crc/secrets";
import {
  CRC_CLIENT_WRITES_ENABLED,
  CRC_LIVE_LIST_ENABLED,
  CrcApiError,
  assertCrcInboundOnly,
  isCrcApiReady,
} from "../src/lib/integrations/crc/http";
import { parseCrcRosterCsv, defaultSyntheticCrcRosterPath } from "../src/lib/integrations/crc/roster";
import { getCrcProvider } from "../src/lib/integrations/providers";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

const testDb = path.join(process.cwd(), "prisma", "test-crc-compare.db");

describe("CRC inbound compare — locks, CSV, fail-closed (no DB)", () => {
  it("keeps writes and live list disabled; CRC_API_KEY is a name only", () => {
    expect(CRC_CLIENT_WRITES_ENABLED).toBe(false);
    expect(CRC_LIVE_LIST_ENABLED).toBe(false);
    expect(CRC_API_KEY_ENV).toBe("CRC_API_KEY");
    expect(CRC_RECOVERY_WRITES_ENV).toBe("CRC_RECOVERY_WRITES_ENABLED");
    expect(getCrcProvider().name).toBe("credit_repair_cloud");
    expect(isCrcApiReady()).toBe(false);
  });

  it("parses the synthetic CSV roster without real PII", () => {
    const csvPath = defaultSyntheticCrcRosterPath();
    expect(fs.existsSync(csvPath)).toBe(true);
    const rows = parseCrcRosterCsv(fs.readFileSync(csvPath, "utf8"));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.crcClientId.startsWith("CRC-SYN-"))).toBe(true);
    const emails = rows.map((r) => r.email).filter(Boolean) as string[];
    for (const master of CONFIRMED_MASTERS) {
      expect(emails).not.toContain(normalizeEmail(master.email));
    }
    expect(CONFIRMED_MASTERS).toHaveLength(26);
  });

  it("refuses CRC write HTTP and live GET", () => {
    expect(() => assertCrcInboundOnly("POST", "/clients")).toThrow(CrcApiError);
    expect(() => assertCrcInboundOnly("GET", "/clients")).toThrow(CrcApiError);
  });

  it("maps ghl.field.crc_client_id onto CREDIT_REPAIR_CLOUD", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/agent-hub/context.ts"), "utf8");
    expect(src).toMatch(/key: "ghl.field.crc_client_id"/);
    expect(src).toMatch(/mapsTo: "ClientIdentifier.provider=CREDIT_REPAIR_CLOUD.externalId"/);
  });
});

describe("CRC inbound compare — existing master records only", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  let matchExistingGrantsClientForCrc: typeof import("../src/lib/integrations/crc/compare").matchExistingGrantsClientForCrc;
  let compareCrcRowToGrants: typeof import("../src/lib/integrations/crc/compare").compareCrcRowToGrants;
  let compareLocalCrcRoster: typeof import("../src/lib/integrations/crc/compare").compareLocalCrcRoster;
  let pullCrcClients: typeof import("../src/lib/integrations/crc/compare").pullCrcClients;
  let attachExternalIdentifier: typeof import("../src/lib/clients/service").attachExternalIdentifier;
  let CRC_RECOVERY_REPORT_TITLE: string;

  const prevCrcKey = process.env[CRC_API_KEY_ENV];
  const prevWrites = process.env[CRC_RECOVERY_WRITES_ENV];

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.GC_ENV = "development";
    delete process.env[CRC_API_KEY_ENV];
    delete process.env[CRC_RECOVERY_WRITES_ENV];
    resetSqliteFromSchema(testDb);

    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;

    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
    const compare = await import("../src/lib/integrations/crc/compare");
    matchExistingGrantsClientForCrc = compare.matchExistingGrantsClientForCrc;
    compareCrcRowToGrants = compare.compareCrcRowToGrants;
    compareLocalCrcRoster = compare.compareLocalCrcRoster;
    pullCrcClients = compare.pullCrcClients;
    const clients = await import("../src/lib/clients/service");
    attachExternalIdentifier = clients.attachExternalIdentifier;
    const report = await import("../src/lib/crc-recovery/report");
    CRC_RECOVERY_REPORT_TITLE = report.CRC_RECOVERY_REPORT_TITLE;
  });

  beforeEach(async () => {
    await prisma.clientIdentifier.deleteMany();
    await prisma.client.deleteMany();
    await prisma.idSequence.deleteMany();
    delete process.env[CRC_API_KEY_ENV];
    delete process.env[CRC_RECOVERY_WRITES_ENV];
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    if (prevCrcKey === undefined) delete process.env[CRC_API_KEY_ENV];
    else process.env[CRC_API_KEY_ENV] = prevCrcKey;
    if (prevWrites === undefined) delete process.env[CRC_RECOVERY_WRITES_ENV];
    else process.env[CRC_RECOVERY_WRITES_ENV] = prevWrites;
  });

  async function seedMaster(input: {
    grantsClientId: string;
    email: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    crcId?: string;
    address?: { line1: string; city: string; state: string; postalCode: string };
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
        addresses: input.address
          ? { create: { ...input.address, country: "US" } }
          : undefined,
      },
    });
    if (input.crcId) {
      await attachExternalIdentifier({
        clientId: client.id,
        provider: "CREDIT_REPAIR_CLOUD",
        externalId: input.crcId,
        metadata: { source: "crc_export", dataPlane: "development" },
      });
    }
    return client;
  }

  it("matches CRC id before email before phone before name+address; never creates", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await seedMaster({
      grantsClientId: "GC-SYN-000014",
      email: "mina.shaw.os@example.test",
      firstName: "Mina",
      lastName: "Shaw",
      crcId: "CRC-SYN-1014",
    });
    await seedMaster({
      grantsClientId: "GC-SYN-000002",
      email: "blair.chen@example.test",
      phone: "5550101002",
      firstName: "Blair",
      lastName: "Chen",
    });
    await seedMaster({
      grantsClientId: "GC-SYN-000003",
      email: "casey.ortiz@example.test",
      phone: "5550101003",
      firstName: "Casey",
      lastName: "Ortiz",
    });
    await seedMaster({
      grantsClientId: "GC-SYN-000005",
      email: "ellis.stone.os@example.test",
      firstName: "Ellis",
      lastName: "Stone",
      address: { line1: "100 Example Ave", city: "Springfield", state: "IL", postalCode: "62701" },
    });

    const byId = await matchExistingGrantsClientForCrc({
      crcClientId: "CRC-SYN-1014",
      firstName: "Mina",
      lastName: "Shaw",
      email: "mina.shaw.other@example.test",
    });
    expect(byId.matchedBy).toBe("crc_id");

    const byEmail = await matchExistingGrantsClientForCrc({
      crcClientId: "CRC-SYN-1002",
      firstName: "Blair",
      lastName: "Chen",
      email: "blair.chen@example.test",
    });
    expect(byEmail.matchedBy).toBe("email");

    const byPhone = await matchExistingGrantsClientForCrc({
      crcClientId: "CRC-SYN-1003",
      firstName: "Casey",
      lastName: "Ortiz",
      email: "casey.ortiz.other@example.test",
      phone: "5550101003",
    });
    expect(byPhone.matchedBy).toBe("phone");

    const byNameAddress = await matchExistingGrantsClientForCrc({
      crcClientId: "CRC-SYN-1005",
      firstName: "Ellis",
      lastName: "Stone",
      line1: "100 Example Ave",
      city: "Springfield",
      state: "IL",
      postalCode: "62701",
    });
    expect(byNameAddress.matchedBy).toBe("name_and_address");

    const before = await prisma.client.count();
    const missing = await compareCrcRowToGrants({
      crcClientId: "CRC-SYN-1004",
      firstName: "Dana",
      lastName: "Kim",
      email: "dana.kim@example.test",
    });
    expect(missing.action).toBe("SKIPPED_NO_MATCH");
    expect(missing.createdClient).toBe(false);
    expect(await prisma.client.count()).toBe(before);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("fail-closes live CRC HTTP without CRC_API_KEY and does not create contacts", async () => {
    const closed = await pullCrcClients({ dryRun: true });
    expect(closed.failedClosed).toBe(true);
    expect(closed.fetched).toBe(0);
    expect(closed.createdClients).toBe(0);
    expect(closed.requiredSecrets).toEqual(["CRC_API_KEY"]);

    process.env[CRC_API_KEY_ENV] = "crc_test_value_do_not_log";
    const pulled = await pullCrcClients({ dryRun: true });
    expect(pulled.liveListEnabled).toBe(false);
    expect(pulled.fetched).toBe(0);
    expect(JSON.stringify(pulled)).not.toContain("crc_test_value_do_not_log");
  });

  it("local CSV dry-run builds the recovery report and refuses writes", async () => {
    const local = await compareLocalCrcRoster();
    expect(local.dryRun).toBe(true);
    expect(local.createdClients).toBe(0);
    expect(local.writesEnabled).toBe(false);
    expect(local.applyRefused).toBe(true);
    expect(local.report.title).toBe(CRC_RECOVERY_REPORT_TITLE);
    expect(local.report.sections.recoveredContactsCreatedInGhl.count).toBe(0);
    expect(local.report.liveSideEffects.ghlCreates).toBe(0);
    expect(local.enroll.welcome).toBe(false);
    expect(local.enroll.fridayPulse).toBe(false);
    expect(local.locks.zapEnabled).toBe(false);
    const blob = JSON.stringify(local.report);
    expect(blob).not.toMatch(/@example\.test/);
    expect(blob).not.toMatch(/555010/);
  });
});
