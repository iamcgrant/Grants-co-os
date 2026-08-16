import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";

const testDb = path.join(process.cwd(), "prisma", "test-lead-attribution.db");

describe("LeadAttribution — fail-closed child of Client", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  let recordLeadAttribution: typeof import("../src/lib/marketing/lead-attribution").recordLeadAttribution;
  let applyVerifiedCollectedAmount: typeof import("../src/lib/marketing/lead-attribution").applyVerifiedCollectedAmount;
  let getRevenueByContent: typeof import("../src/lib/marketing/lead-attribution").getRevenueByContent;
  let parseAttributionSource: typeof import("../src/lib/marketing/lead-attribution").parseAttributionSource;
  let LeadAttributionError: typeof import("../src/lib/marketing/lead-attribution").LeadAttributionError;
  let DATA_UNAVAILABLE: typeof import("../src/lib/marketing/lead-attribution").DATA_UNAVAILABLE;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${testDb}`;
    resetSqliteFromSchema(testDb);

    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;

    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
    const attr = await import("../src/lib/marketing/lead-attribution");
    recordLeadAttribution = attr.recordLeadAttribution;
    applyVerifiedCollectedAmount = attr.applyVerifiedCollectedAmount;
    getRevenueByContent = attr.getRevenueByContent;
    parseAttributionSource = attr.parseAttributionSource;
    LeadAttributionError = attr.LeadAttributionError;
    DATA_UNAVAILABLE = attr.DATA_UNAVAILABLE;
  });

  beforeEach(async () => {
    await prisma.leadAttribution.deleteMany();
    await prisma.paymentTransaction.deleteMany();
    await prisma.leadSource.deleteMany();
    await prisma.client.deleteMany();
    await prisma.idSequence.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  async function seedMaster(grantsClientId = "GC-000201") {
    return prisma.client.create({
      data: {
        grantsClientId,
        email: `${grantsClientId.toLowerCase()}@example.com`,
        emailNormalized: `${grantsClientId.toLowerCase()}@example.com`,
        firstName: "Pat",
        lastName: "Master",
      },
    });
  }

  async function seedSucceededPayment(clientId: string, amountCents: number, id = "pay_verified_1") {
    return prisma.paymentTransaction.create({
      data: {
        id,
        clientId,
        provider: "AUTHORIZE_NET",
        providerTransactionId: `txn_${id}`,
        idempotencyKey: `idem_${id}`,
        amountCents,
        status: "SUCCEEDED",
      },
    });
  }

  it("row belongs to one existing client (never a second master)", async () => {
    const a = await seedMaster("GC-000201");
    const b = await seedMaster("GC-000202");

    const row = await recordLeadAttribution({
      clientId: a.id,
      source: "facebook",
      campaignId: "camp_1",
      contentId: "vid_1",
      adId: "ad_1",
      cta: "book_consult",
    });

    expect(row.clientId).toBe(a.id);
    expect(await prisma.leadAttribution.count({ where: { clientId: a.id } })).toBe(1);
    expect(await prisma.leadAttribution.count({ where: { clientId: b.id } })).toBe(0);
    expect(await prisma.client.count()).toBe(2);

    const loaded = await prisma.client.findUnique({
      where: { id: a.id },
      include: { leadAttributions: true },
    });
    expect(loaded?.leadAttributions).toHaveLength(1);
    expect(loaded?.leadAttributions[0]?.id).toBe(row.id);
  });

  it("refuses create-client-from-attribution and does not insert a Client", async () => {
    await expect(
      recordLeadAttribution({
        createClient: true,
        email: "new.lead@example.com",
        firstName: "New",
        lastName: "Lead",
        source: "facebook",
      }),
    ).rejects.toMatchObject({ code: "REFUSE_CREATE_CLIENT" });

    await expect(
      recordLeadAttribution({
        source: "instagram",
        campaignId: "camp_x",
      }),
    ).rejects.toMatchObject({ code: "CLIENT_REQUIRED" });

    await expect(
      recordLeadAttribution({
        clientId: "does-not-exist",
        source: "youtube",
      }),
    ).rejects.toMatchObject({ code: "CLIENT_NOT_FOUND" });

    expect(await prisma.client.count()).toBe(0);
    expect(await prisma.leadAttribution.count()).toBe(0);
    expect(await prisma.leadSource.count()).toBe(0);
  });

  it("amount_collected stays null without a payment fact (guessed ad revenue dropped)", async () => {
    const client = await seedMaster();

    const row = await recordLeadAttribution({
      clientId: client.id,
      source: "facebook",
      campaignId: "camp_1",
      contentId: "vid_1",
      adId: "ad_1",
      cta: "book_consult",
      amountCollected: 99_00,
    });

    expect(row.amountCollected).toBeNull();

    const report = await getRevenueByContent();
    expect(report.status).toBe(DATA_UNAVAILABLE);
    expect(report.rows).toEqual([]);
  });

  it("unknown source is not coerced to organic", async () => {
    const client = await seedMaster();

    expect(parseAttributionSource(undefined)).toBe("unknown");
    expect(parseAttributionSource("")).toBe("unknown");
    expect(parseAttributionSource("unknown")).toBe("unknown");
    expect(() => parseAttributionSource("organic")).toThrow(LeadAttributionError);
    expect(() => parseAttributionSource("organic")).toThrow(/not coerced/i);

    const row = await recordLeadAttribution({
      clientId: client.id,
      source: "unknown",
    });
    expect(row.source).toBe("unknown");
    expect(row.source).not.toBe("direct");
    expect(String(row.source)).not.toBe("organic");

    const missing = await recordLeadAttribution({ clientId: client.id });
    expect(missing.source).toBe("unknown");

    const report = await getRevenueByContent();
    expect(report.status).toBe(DATA_UNAVAILABLE);
    expect(report.reason).toMatch(/DATA UNAVAILABLE/i);
  });

  it("fills amount_collected only from a verified payment fact on the same client", async () => {
    const client = await seedMaster();
    const other = await seedMaster("GC-000203");
    const payment = await seedSucceededPayment(client.id, 70_000);
    await seedSucceededPayment(other.id, 12_000, "pay_other");

    const row = await recordLeadAttribution({
      clientId: client.id,
      source: "instagram",
      campaignId: "camp_ig",
      contentId: "reel_1",
      adId: "ad_9",
      cta: "apply_now",
      paymentTransactionId: payment.id,
    });
    expect(row.amountCollected).toBe(70_000);

    await expect(
      applyVerifiedCollectedAmount({
        attributionId: row.id,
        paymentTransactionId: "pay_other",
        guessedAdRevenueCents: 999_00,
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_FACT_MISMATCH" });

    const report = await getRevenueByContent();
    expect(report.status).toBe("AVAILABLE");
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.amountCollected).toBe(70_000);
  });

  it("refuses to overwrite newer verified payment data with guessed ad revenue", async () => {
    const client = await seedMaster();
    const older = await seedSucceededPayment(client.id, 50_000, "pay_older");
    const row = await recordLeadAttribution({
      clientId: client.id,
      source: "email",
      paymentTransactionId: older.id,
    });
    expect(row.amountCollected).toBe(50_000);

    await prisma.leadAttribution.update({
      where: { id: row.id },
      data: { amountCollected: 80_000, updatedAt: new Date(Date.now() + 60_000) },
    });
    await prisma.paymentTransaction.update({
      where: { id: older.id },
      data: { updatedAt: new Date(Date.now() - 60_000) },
    });

    await expect(
      applyVerifiedCollectedAmount({
        attributionId: row.id,
        paymentTransactionId: older.id,
        guessedAdRevenueCents: 10_00,
      }),
    ).rejects.toMatchObject({ code: "REFUSE_OVERWRITE_NEWER_PAYMENT" });

    const kept = await prisma.leadAttribution.findUniqueOrThrow({ where: { id: row.id } });
    expect(kept.amountCollected).toBe(80_000);
  });

  it("source module never creates clients or leads", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/lib/marketing/lead-attribution.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/from ["']@\/lib\/clients\/service["']/);
    expect(src).not.toMatch(/leadSource\.create/);
    expect(src).not.toMatch(/prisma\.client\.create/);
    expect(src).toMatch(/REFUSE_CREATE_CLIENT/);
    expect(src).toMatch(/DATA_UNAVAILABLE/);
  });

  it("does not wire the stamp into live GHL or DisputeFox intake", () => {
    const ghl = fs.readFileSync(path.join(process.cwd(), "src/lib/integrations/ghl/sync.ts"), "utf8");
    const df = fs.readFileSync(
      path.join(process.cwd(), "src/lib/integrations/disputefox/sync.ts"),
      "utf8",
    );
    expect(ghl).not.toMatch(/from ["']@\/lib\/marketing\/lead-attribution["']/);
    expect(df).not.toMatch(/from ["']@\/lib\/marketing\/lead-attribution["']/);
    expect(ghl).toMatch(/STAMP LANDING \(not wired this PR/);
    expect(df).toMatch(/STAMP LANDING \(not wired this PR/);
  });
});
