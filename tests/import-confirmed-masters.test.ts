import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";
import {
  CONFIRMED_MASTERS,
  CONFIRMED_MASTER_TAG,
  FORBIDDEN_IMPORT_EMAILS,
} from "../src/lib/clients/confirmed-masters";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

const testDb = path.join(process.cwd(), "prisma", "test-import-confirmed-masters.db");

describe("Charles-confirmed master client import (one human = one record)", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  let importConfirmedMasters: typeof import("../src/lib/clients/import-confirmed-masters").importConfirmedMasters;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${testDb}`;
    resetSqliteFromSchema(testDb);

    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;

    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
    const mod = await import("../src/lib/clients/import-confirmed-masters");
    importConfirmedMasters = mod.importConfirmedMasters;
  });

  beforeEach(async () => {
    await prisma.clientTimelineEvent.deleteMany();
    await prisma.auditLog.deleteMany().catch(() => undefined);
    await prisma.clientIdentifier.deleteMany();
    await prisma.client.deleteMany();
    await prisma.idSequence.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it("has exactly 26 unique GHL identity emails and no forbidden extras", () => {
    expect(CONFIRMED_MASTERS).toHaveLength(26);
    const emails = CONFIRMED_MASTERS.map((r) => normalizeEmail(r.email));
    expect(new Set(emails).size).toBe(26);
    for (const forbidden of FORBIDDEN_IMPORT_EMAILS) {
      expect(emails).not.toContain(normalizeEmail(forbidden));
    }
    expect(emails).toContain("kskymommy09@icloud.com");
    expect(emails).toContain("dyquannmcbride39@gmail.com");
    expect(emails).not.toContain("charlesjgrant@aol.com");
  });

  it("creates 26 ACTIVE master records tagged from recon, without GHL ids", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await importConfirmedMasters();

    expect(result.roster).toBe(26);
    expect(result.created).toBe(26);
    expect(result.skippedExisting).toBe(0);
    expect(result.skippedDuplicate).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.createdGhlIdentifiers).toBe(0);
    expect(await prisma.client.count()).toBe(26);
    expect(await prisma.clientIdentifier.count()).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    const kimberly = await prisma.client.findUniqueOrThrow({
      where: { emailNormalized: "kskymommy09@icloud.com" },
    });
    expect(kimberly.status).toBe("ACTIVE");
    expect(kimberly.notes).toContain(CONFIRMED_MASTER_TAG);
    expect(kimberly.notes).toMatch(/KimberlyBr490@gmail.com/i);
    expect(
      await prisma.client.findUnique({
        where: { emailNormalized: "kimberlybr490@gmail.com" },
      }),
    ).toBeNull();

    const dyquann = await prisma.client.findUniqueOrThrow({
      where: { emailNormalized: "dyquannmcbride39@gmail.com" },
    });
    expect(dyquann.phoneNormalized).toBe(normalizePhone("(912) 856-6083"));
    expect(
      await prisma.client.findUnique({
        where: { emailNormalized: "kandwmcbride@gmail.com" },
      }),
    ).toBeNull();

    expect(
      await prisma.client.findUnique({
        where: { emailNormalized: "charlesjgrant@aol.com" },
      }),
    ).toBeNull();

    const tagged = await prisma.client.count({
      where: { notes: { contains: CONFIRMED_MASTER_TAG }, status: "ACTIVE" },
    });
    expect(tagged).toBe(26);
  });

  it("is idempotent and does not create a second record for the same human", async () => {
    await importConfirmedMasters();
    const second = await importConfirmedMasters();
    expect(second.created).toBe(0);
    expect(second.skippedExisting).toBe(26);
    expect(await prisma.client.count()).toBe(26);
    expect(await prisma.clientIdentifier.count({ where: { provider: "GHL" } })).toBe(0);
  });
});
