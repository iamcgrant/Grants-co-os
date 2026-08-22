import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";

const testDb = path.join(process.cwd(), "prisma", "test-cognito-workspace.db");

describe("official Cognito Forms workspace", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  let pullCognitoSubmissions: typeof import("../src/lib/integrations/cognito/workspace").pullCognitoSubmissions;
  let probeCognitoHealth: typeof import("../src/lib/integrations/cognito/health").probeCognitoHealth;
  const prevKey = process.env.COGNITO_API_KEY;

  beforeAll(async () => {
    delete process.env.COGNITO_API_KEY;
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.AUTH_SECRET = "test-secret-for-vitest-only-32chars!!";
    resetSqliteFromSchema(testDb);
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    vi.resetModules();
    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
    const workspace = await import("../src/lib/integrations/cognito/workspace");
    pullCognitoSubmissions = workspace.pullCognitoSubmissions;
    const health = await import("../src/lib/integrations/cognito/health");
    probeCognitoHealth = health.probeCognitoHealth;
  });

  afterEach(() => {
    delete process.env.COGNITO_API_KEY;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (prevKey === undefined) delete process.env.COGNITO_API_KEY;
    else process.env.COGNITO_API_KEY = prevKey;
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it("desk is the official Cognito home and the API client does not scrape", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/tax/cognito/page.tsx"), "utf8");
    expect(page).toMatch(/GuardedPortalDesk/);
    expect(page).toMatch(/deskId: "cognito"/);
    expect(page).not.toMatch(/cheerio|puppeteer|playwright/i);
    expect(page).not.toMatch(/CognitoPullForm|COGNITO_API_KEY|API health/);
    const client = fs.readFileSync(path.join(process.cwd(), "src/lib/integrations/cognito/client.ts"), "utf8");
    const config = fs.readFileSync(path.join(process.cwd(), "src/lib/integrations/cognito/config.ts"), "utf8");
    expect(config).toMatch(/www\.cognitoforms\.com\/api/);
    expect(client).toMatch(/Authorization: `Bearer/);
  });

  it("fails closed without COGNITO_API_KEY and never CONNECTS on key presence", async () => {
    const before = await probeCognitoHealth();
    expect(before.status).toBe("ACTION_REQUIRED");
    expect(before.detail).toMatch(/COGNITO_API_KEY/);
    await expect(pullCognitoSubmissions({})).rejects.toThrow(/COGNITO_API_KEY/);

    process.env.COGNITO_API_KEY = "cf_test_not_a_real_key";
    const degraded = await probeCognitoHealth();
    expect(degraded.status).toBe("DEGRADED");
    expect(degraded.status).not.toBe("CONNECTED");
    expect(degraded.detail).toMatch(/Key presence is never CONNECTED/);
  });

  it("pulls official forms/entries and matches an existing Grants master by email", async () => {
    process.env.COGNITO_API_KEY = "cf_test_not_a_real_key";
    const client = await prisma.client.create({
      data: {
        grantsClientId: "GC-CF1001",
        email: "intake@example.com",
        emailNormalized: "intake@example.com",
        firstName: "Ina",
        lastName: "Take",
      },
    });

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/forms")) {
        return new Response(
          JSON.stringify([{ Id: 44, Name: "Tax Organizer" }, { Id: 45, Name: "Client Intake" }]),
          { status: 200 },
        );
      }
      if (url.includes("/forms/44/entries")) {
        return new Response(
          JSON.stringify([
            {
              Id: 901,
              Email: "intake@example.com",
              FirstName: "Ina",
              LastName: "Take",
              Status: "Submitted",
              DateCreated: "2026-03-01T12:00:00.000Z",
            },
          ]),
          { status: 200 },
        );
      }
      if (url.includes("/forms/45/entries")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });

    const pulled = await pullCognitoSubmissions({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(pulled.formCount).toBe(2);
    expect(pulled.submissions).toHaveLength(1);
    expect(pulled.submissions[0].taxRelated).toBe(true);
    expect(pulled.submissions[0].grantsClientId).toBe(client.grantsClientId);
    expect(fetchImpl).toHaveBeenCalled();
    const firstUrl = String(fetchImpl.mock.calls[0][0]);
    expect(firstUrl).toMatch(/https:\/\/www\.cognitoforms\.com\/api\/forms/);

    const ident = await prisma.clientIdentifier.findFirst({
      where: { clientId: client.id, provider: "COGNITO" },
    });
    expect(ident?.externalId).toBe("44:901");

    const health = await probeCognitoHealth();
    expect(health.status).toBe("CONNECTED");
    expect(health.detail).toMatch(/Official Cognito Forms API/);
  });
});
