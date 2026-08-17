import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";

const testDb = path.join(process.cwd(), "prisma", "test-health-search.db");

describe("system health + universal search", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;

  beforeAll(async () => {
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

  afterAll(async () => {
    await prisma.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
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
