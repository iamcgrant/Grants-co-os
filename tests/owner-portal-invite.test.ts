import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";
import { isStrongPassword } from "../src/lib/auth/password-policy";
import { LIVE_VERCEL_APP_ORIGIN } from "../src/lib/access/origins";

const testDb = path.join(process.cwd(), "prisma", "test-owner-portal.db");

describe("password policy", () => {
  it("rejects short or simple passwords", () => {
    expect(isStrongPassword("short")).toBe(false);
    expect(isStrongPassword("NoNumberOrSymbol")).toBe(false);
    expect(isStrongPassword("GcOs!Everyday9a")).toBe(true);
  });
});

describe("owner bootstrap + client portal invite", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.AUTH_SECRET = "test-secret-for-vitest-only-32chars!!";
    delete process.env.VERCEL;
    resetSqliteFromSchema(testDb);
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    vi.resetModules();
    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it("creates the owner with a usable password and does not reset it later", async () => {
    process.env.OWNER_BOOTSTRAP_PASSWORD = "GcOs!Everyday9a";
    process.env.OWNER_BOOTSTRAP_FORCE = "";
    const { ensureOwnerPasswordFromEnv } = await import("../src/lib/auth/owner-bootstrap");
    const first = await ensureOwnerPasswordFromEnv();
    expect(first.created).toBe(true);
    expect(first.updated).toBe(true);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: "owner@grantsandco.com" },
    });
    expect(owner.mustChangePassword).toBe(false);
    expect(owner.role).toBe("OWNER");

    const second = await ensureOwnerPasswordFromEnv();
    expect(second.updated).toBe(false);
    expect(second.reason).toMatch(/already has an active password/);
  });

  it("creates a client portal user and a setup URL on the live origin", async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: "owner@grantsandco.com" },
    });
    const client = await prisma.client.create({
      data: {
        grantsClientId: "GC-009902",
        email: "portal.user@example.com",
        emailNormalized: "portal.user@example.com",
        firstName: "Pat",
        lastName: "Portal",
      },
    });
    const { inviteClientPortal } = await import("../src/lib/clients/portal-invite");
    const invited = await inviteClientPortal({
      actorId: owner.id,
      clientId: client.id,
      baseUrl: LIVE_VERCEL_APP_ORIGIN,
    });
    expect(invited.email).toBe("portal.user@example.com");
    expect(invited.setupUrl).toContain(`${LIVE_VERCEL_APP_ORIGIN}/set-password?token=`);
    const linked = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(linked.userId).toBeTruthy();
    const portalUser = await prisma.user.findUniqueOrThrow({ where: { id: linked.userId! } });
    expect(portalUser.role).toBe("CLIENT");
    expect(portalUser.mustChangePassword).toBe(true);
  });
});
