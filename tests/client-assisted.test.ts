import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";
import { CLIENT_ASSISTED_SOURCE } from "@/lib/credit/client-assisted-source";

const testDb = path.join(process.cwd(), "prisma", "test-client-assisted.db");

describe("client-assisted Credit Karma scores", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  let recordClientAssistedScore: typeof import("../src/lib/credit/client-assisted").recordClientAssistedScore;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${testDb}`;
    resetSqliteFromSchema(testDb);
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    vi.resetModules();
    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
    ({ recordClientAssistedScore } = await import("../src/lib/credit/client-assisted"));
  });

  afterAll(async () => {
    await prisma.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it("stores CLIENT_ASSISTED source and rejects scrape-shaped use", async () => {
    const client = await prisma.client.create({
      data: {
        grantsClientId: "GC-900001",
        email: "ck@example.com",
        emailNormalized: "ck@example.com",
        firstName: "Kim",
        lastName: "Assisted",
      },
    });
    const row = await recordClientAssistedScore({
      clientId: client.id,
      bureau: "EXPERIAN",
      score: 701,
      scoringModel: "VantageScore 3.0",
    });
    expect(row.source).toBe(CLIENT_ASSISTED_SOURCE);
    expect(row.score).toBe(701);
    await expect(
      recordClientAssistedScore({
        clientId: client.id,
        bureau: "EXPERIAN",
        score: 12,
        scoringModel: "VantageScore 3.0",
      }),
    ).rejects.toThrow(/300/);
  });

  it("keeps the client form off the Prisma/pg module graph", () => {
    const form = fs.readFileSync(
      path.join(process.cwd(), "src/components/credit/ClientAssistedScoreForm.tsx"),
      "utf8",
    );
    expect(form).toContain("use client");
    expect(form).toContain("@/lib/credit/client-assisted-source");
    expect(form).not.toContain("@/lib/credit/client-assisted\"");
    expect(form).not.toContain("@/lib/db/prisma");
  });
});
