import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";

const testDb = path.join(process.cwd(), "prisma", "test-health-search.db");

const ENV_KEYS = [
  "GHL_API_KEY",
  "GHL_LOCATION_ID",
  "DISPUTEFOX_API_KEY",
  "DISPUTEFOX_API_PROBE_URL",
  "SMARTCREDIT_SPONSOR_URL",
  "SMARTCREDIT_SPONSOR_CODE",
  "SMARTCREDIT_API_KEY",
  "SMARTCREDIT_API_PROBE_URL",
  "COMMAS_API_KEY",
  "COGNITO_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_TEAM_CHAT_IDS",
] as const;

function component(
  health: { components: Array<{ component: string }> },
  id: string,
) {
  const found = health.components.find((c) => c.component === id);
  expect(found, `missing health component ${id}`).toBeTruthy();
  return found!;
}

describe("system health + universal search", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  const prevEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeAll(async () => {
    for (const key of ENV_KEYS) {
      prevEnv[key] = process.env[key];
      delete process.env[key];
    }
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.PAYMENT_PROVIDER = "mock";
    process.env.AUTH_SECRET = "test-secret-for-vitest-only-32chars!!";
    resetSqliteFromSchema(testDb);

    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    vi.resetModules();

    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    for (const key of ENV_KEYS) {
      if (prevEnv[key] === undefined) delete process.env[key];
      else process.env[key] = prevEnv[key];
    }
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it("labels the database engine from DATABASE_URL without inventing Postgres", async () => {
    const { resolveDatabaseEngine, databaseRespondingDetail } = await import("@/lib/system/health");
    expect(resolveDatabaseEngine("file:./dev.db")).toBe("SQLite");
    expect(resolveDatabaseEngine(undefined)).toBe("SQLite");
    expect(resolveDatabaseEngine("postgresql://neon.example/os?sslmode=require")).toBe("Postgres");
    expect(resolveDatabaseEngine("postgres://localhost/os")).toBe("Postgres");
    expect(databaseRespondingDetail("Postgres")).toBe("Postgres/Prisma responding");
    expect(databaseRespondingDetail("SQLite")).toBe("SQLite/Prisma responding");
  });

  it("collects system health without leaking secrets", async () => {
    const { collectSystemHealth } = await import("@/lib/system/health");
    const health = await collectSystemHealth();
    expect(["CONNECTED", "DEGRADED", "ACTION_REQUIRED", "OFFLINE"]).toContain(health.overall);
    expect(health.components.some((c) => c.component === "commas")).toBe(true);
    expect(health.components.some((c) => c.component === "database")).toBe(true);
    const blob = JSON.stringify(health);
    expect(blob.toLowerCase()).not.toContain("whsk_");
  });

  it("splits GHL and does not mark Connected on API key / sponsor presence alone", async () => {
    await prisma.message.deleteMany();
    await prisma.webhookEvent.deleteMany();
    await prisma.integrationSyncEvent.deleteMany();
    await prisma.clientIdentifier.deleteMany({ where: { provider: "DISPUTEFOX" } });
    await prisma.creditConnection.updateMany({
      where: { provider: "SMARTCREDIT" },
      data: { lastSyncedAt: null },
    });

    process.env.GHL_API_KEY = "pk_test_not_a_real_key";
    process.env.GHL_LOCATION_ID = "loc_test";
    process.env.DISPUTEFOX_API_KEY = "df_test_not_a_real_key";
    process.env.SMARTCREDIT_SPONSOR_URL = "https://www.smartcredit.com/join/?pid=TEST";

    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ message: "The token is not authorized for this scope." }), {
        status: 401,
      }),
    );

    const { collectSystemHealth } = await import("@/lib/system/health");
    const health = await collectSystemHealth();
    const ids = health.components.map((c) => c.component);

    expect(ids).toEqual(expect.arrayContaining([
      "database",
      "ghl_auth",
      "ghl_inbound_pull",
      "ghl_outbound",
      "email",
      "voice",
      "telegram",
      "gmail",
      "ghl_webhook",
      "disputefox",
      "smartcredit",
      "credit_karma",
      "imessage",
      "cloud_tax_office",
      "cognito",
      "sbtpg",
    ]));
    expect(ids).not.toContain("ghl");

    const database = component(health, "database");
    expect(database.status).toBe("CONNECTED");
    expect(database.detail).toBe("SQLite/Prisma responding");
    expect(database.detail).not.toMatch(/SQLite\/Prisma responding.*Postgres|Postgres.*SQLite\/Prisma/);

    expect(component(health, "ghl_auth").status).toBe("DEGRADED");
    expect(component(health, "ghl_auth").detail).toMatch(/no successful authenticated GHL operation/);
    expect(component(health, "ghl_auth").lastSuccessAt).toBeNull();

    expect(component(health, "ghl_inbound_pull").status).toBe("DEGRADED");
    expect(component(health, "ghl_inbound_pull").lastSuccessAt).toBeNull();

    expect(component(health, "ghl_outbound").status).toBe("ACTION_REQUIRED");
    expect(component(health, "ghl_outbound").detail).toMatch(/conversations\/message\.write|GHL_API_KEY/);
    expect(component(health, "email").status).toBe("ACTION_REQUIRED");
    expect(component(health, "email").detail).toMatch(/conversations\/message\.write|GHL_API_KEY/);
    expect(component(health, "voice").status).toBe("ACTION_REQUIRED");
    expect(component(health, "voice").lastSuccessAt).toBeNull();
    expect(component(health, "telegram").status).toBe("ACTION_REQUIRED");
    expect(component(health, "telegram").detail).toMatch(/TELEGRAM_BOT_TOKEN/);
    expect(component(health, "ghl_webhook").status).toBe("ACTION_REQUIRED");
    expect(component(health, "ghl_webhook").lastSuccessAt).toBeNull();

    expect(component(health, "disputefox").status).toBe("DEGRADED");
    expect(component(health, "disputefox").status).not.toBe("CONNECTED");
    expect(component(health, "disputefox").detail).toMatch(/probe URL|key presence|not CONNECTED|Live list stays off/i);
    expect(component(health, "disputefox").lastSuccessAt).toBeNull();

    expect(component(health, "smartcredit").status).toBe("DEGRADED");
    expect(component(health, "smartcredit").detail).toMatch(/no live score sync/);
    expect(component(health, "smartcredit").lastSuccessAt).toBeNull();

    expect(component(health, "credit_karma").status).toBe("DEGRADED");
    expect(component(health, "credit_karma").detail).toMatch(/client-assisted/i);
    expect(component(health, "imessage").status).toBe("DEGRADED");
    expect(component(health, "cloud_tax_office").status).toBe("ACTION_REQUIRED");
    expect(component(health, "sbtpg").status).toBe("ACTION_REQUIRED");
    expect(component(health, "gmail").status).toBe("ACTION_REQUIRED");
    expect(component(health, "gmail").detail).toMatch(/GMAIL_/);
    expect(component(health, "cognito").status).toBe("ACTION_REQUIRED");
    expect(component(health, "commas").status).not.toBe("CONNECTED");
    expect(component(health, "commas").detail).toMatch(/COMMAS_API_KEY|never CONNECTED/i);
  });

  it("records lastSuccessAt only from real pull / send / webhook rows; DisputeFox stays probe-only", async () => {
    const pulledAt = new Date("2026-03-01T15:00:00.000Z");
    const sentSmsAt = new Date("2026-03-02T16:00:00.000Z");
    const sentEmailAt = new Date("2026-03-03T17:00:00.000Z");
    const ghlWebhookAt = new Date("2026-03-04T18:00:00.000Z");
    const dfAttachedAt = new Date("2026-03-05T19:00:00.000Z");
    await prisma.integrationSyncEvent.deleteMany({
      where: { entityType: { in: ["SMARTCREDIT_SESSION", "SMARTCREDIT_ENROLLMENT"] } },
    });
    await prisma.creditConnection.updateMany({
      where: { provider: "SMARTCREDIT" },
      data: { lastSyncedAt: null },
    });

    const client = await prisma.client.create({
      data: {
        grantsClientId: "GC-HEALTH1",
        email: "health.rows@example.com",
        emailNormalized: "health.rows@example.com",
        firstName: "Health",
        lastName: "Rows",
      },
    });
    const conversation = await prisma.conversation.create({
      data: { kind: "CLIENT", clientId: client.id },
    });
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        channel: "SMS",
        body: "pulled inbound",
        isInternal: false,
        deliveryStatus: "RECORDED",
        provider: "GHL",
        externalId: "ghl_in_1",
        createdAt: pulledAt,
        metadataJson: JSON.stringify({ source: "ghl_api" }),
      },
    });
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        channel: "SMS",
        body: "sent outbound",
        isInternal: false,
        deliveryStatus: "SENT",
        provider: "GHL",
        externalId: "ghl_out_sms_1",
        createdAt: sentSmsAt,
      },
    });
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        channel: "EMAIL",
        body: "sent email",
        isInternal: false,
        deliveryStatus: "SENT",
        provider: "GHL",
        externalId: "ghl_out_email_1",
        createdAt: sentEmailAt,
      },
    });
    await prisma.webhookEvent.create({
      data: {
        provider: "ghl",
        providerEventId: "ghl_evt_1",
        eventType: "InboundMessage",
        payloadJson: "{}",
        status: "PROCESSED",
        processedAt: ghlWebhookAt,
      },
    });
    await prisma.clientIdentifier.create({
      data: {
        clientId: client.id,
        provider: "DISPUTEFOX",
        externalId: "df_health_1",
        createdAt: dfAttachedAt,
        updatedAt: dfAttachedAt,
      },
    });

    const { collectSystemHealth } = await import("@/lib/system/health");
    const health = await collectSystemHealth();

    expect(component(health, "ghl_auth").status).toBe("CONNECTED");
    expect(component(health, "ghl_auth").lastSuccessAt).toBe(sentEmailAt.toISOString());

    expect(component(health, "ghl_inbound_pull").status).toBe("CONNECTED");
    expect(component(health, "ghl_inbound_pull").lastSuccessAt).toBe(pulledAt.toISOString());

    expect(component(health, "ghl_outbound").status).toBe("ACTION_REQUIRED");
    expect(component(health, "ghl_outbound").lastSuccessAt).toBe(sentSmsAt.toISOString());
    expect(component(health, "ghl_outbound").detail).toMatch(/GHL_API_KEY|conversations\/message\.write/);

    expect(component(health, "email").status).toBe("ACTION_REQUIRED");
    expect(component(health, "email").lastSuccessAt).toBe(sentEmailAt.toISOString());
    expect(component(health, "email").detail).toMatch(/GHL_API_KEY|conversations\/message\.write/);

    expect(component(health, "ghl_webhook").status).toBe("CONNECTED");
    expect(component(health, "ghl_webhook").lastSuccessAt).toBe(ghlWebhookAt.toISOString());
    expect(component(health, "ghl_webhook").detail).toMatch(/InboundMessage/);

    expect(component(health, "disputefox").status).not.toBe("CONNECTED");
    expect(component(health, "disputefox").lastSuccessAt).toBeNull();

    expect(component(health, "voice").status).toBe("ACTION_REQUIRED");
    expect(component(health, "voice").lastSuccessAt).toBeNull();
    expect(component(health, "smartcredit").status).toBe("ACTION_REQUIRED");
    expect(component(health, "smartcredit").lastSuccessAt).toBeNull();
    expect(component(health, "credit_karma").status).toBe("DEGRADED");
    expect(component(health, "telegram").status).toBe("ACTION_REQUIRED");
  });

  it("marks SmartCredit CONNECTED only after a recorded workspace operation", async () => {
    const client = await prisma.client.create({
      data: {
        grantsClientId: "GC-SCHEALTH",
        email: "sc.health@example.com",
        emailNormalized: "sc.health@example.com",
        firstName: "Smart",
        lastName: "Health",
      },
    });
    const { recordSmartCreditSession } = await import("@/lib/credit/smartcredit-workspace");
    await recordSmartCreditSession({
      clientId: client.id,
      kind: "PACKET",
      notes: "Packet assembled in OS",
    });
    const { collectSystemHealth } = await import("@/lib/system/health");
    const health = await collectSystemHealth();
    expect(component(health, "smartcredit").status).toBe("CONNECTED");
    expect(component(health, "smartcredit").lastSuccessAt).toBeTruthy();
    expect(component(health, "smartcredit").detail).toMatch(/Recorded SmartCredit workspace operation/);
  });

  it("marks SMS/email/voice CONNECTED only after live probes succeed", async () => {
    process.env.GHL_API_KEY = "pk_test_not_a_real_key";
    process.env.GHL_LOCATION_ID = "loc_test";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String((init as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (url.includes("/conversations/messages") && method === "POST") {
        return new Response(JSON.stringify({ message: "validation" }), { status: 400 });
      }
      if (url.includes("/conversations/search")) {
        return new Response(JSON.stringify({ conversations: [] }), { status: 200 });
      }
      if (url.includes("/phone-system/numbers") || url.includes("/phone-system/voice-ai")) {
        return new Response(JSON.stringify({ numbers: [{ id: "n1", phone: "+15551230000" }] }), {
          status: 200,
        });
      }
      return new Response("{}", { status: 404 });
    });

    const { collectSystemHealth } = await import("@/lib/system/health");
    const health = await collectSystemHealth();
    expect(component(health, "ghl_outbound").status).toBe("CONNECTED");
    expect(component(health, "email").status).toBe("CONNECTED");
    expect(component(health, "voice").status).toBe("CONNECTED");
    expect(component(health, "telegram").status).toBe("ACTION_REQUIRED");
  });

  it("searches clients and invoices", async () => {
    const { universalSearch } = await import("@/lib/search/universal");
    const { nextGrantsClientId, nextInvoiceNumber } = await import("@/lib/clients/identity");

    const grantsClientId = await nextGrantsClientId();
    const client = await prisma.client.create({
      data: {
        grantsClientId,
        email: "donna.james@example.com",
        emailNormalized: "donna.james@example.com",
        firstName: "Donna",
        lastName: "James",
        phone: "5559998888",
        phoneNormalized: "5559998888",
      },
    });
    await prisma.clientIdentifier.create({
      data: { clientId: client.id, provider: "GHL", externalId: "ghl_abc_123" },
    });
    const invoiceNumber = await nextInvoiceNumber();
    await prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId: client.id,
        status: "DUE",
        amountCents: 75000,
        description: "Credit Optimization",
      },
    });

    const byName = await universalSearch("Donna");
    expect(byName.some((h) => h.type === "client")).toBe(true);

    const byInvoice = await universalSearch(invoiceNumber);
    expect(byInvoice.some((h) => h.type === "invoice")).toBe(true);

    const byGhl = await universalSearch("ghl_abc_123");
    expect(byGhl.some((h) => h.href.includes(client.id))).toBe(true);
  });
});
