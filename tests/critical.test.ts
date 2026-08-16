import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, Role, CreditBureau } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import { MockPaymentProvider } from "../src/lib/payments/mock-provider";
import {
  hasPermission,
  canAccessFinancialData,
} from "../src/lib/rbac/permissions";
import { normalizeEmail, normalizePhone } from "../src/lib/clients/identity";

const testDb = path.join(process.cwd(), "prisma", "test.db");

function makePrisma() {
  const adapter = new PrismaBetterSqlite3({ url: `file:${testDb}` });
  return new PrismaClient({ adapter });
}

describe("Grants & Co OS — critical financial & identity tests", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    execSync("npx prisma db push", {
      env: { ...process.env, DATABASE_URL: `file:${testDb}` },
      stdio: "pipe",
    });
    prisma = makePrisma();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it("bootstraps schema and creates users", async () => {
    await prisma.idSequence.create({ data: { name: "grants_client", value: 0 } });
    await prisma.idSequence.create({ data: { name: "invoice", value: 1000 } });

    const hash = await bcrypt.hash("testpass", 10);
    await prisma.user.create({
      data: {
        email: "owner@test.com",
        passwordHash: hash,
        firstName: "Owner",
        lastName: "Test",
        role: Role.OWNER,
      },
    });
    await prisma.user.create({
      data: {
        email: "preparer@test.com",
        passwordHash: hash,
        firstName: "Prep",
        lastName: "Test",
        role: Role.FILE_PREPARER,
      },
    });

    expect(await prisma.user.count()).toBe(2);
  });

  it("creates master client IDs sequentially as GC-000001", async () => {
    const id1 = await prisma.$transaction(async (tx) => {
      const seq = await tx.idSequence.upsert({
        where: { name: "grants_client" },
        create: { name: "grants_client", value: 1 },
        update: { value: { increment: 1 } },
      });
      return `GC-${String(seq.value).padStart(6, "0")}`;
    });
    const id2 = await prisma.$transaction(async (tx) => {
      const seq = await tx.idSequence.update({
        where: { name: "grants_client" },
        data: { value: { increment: 1 } },
      });
      return `GC-${String(seq.value).padStart(6, "0")}`;
    });

    expect(id1).toBe("GC-000001");
    expect(id2).toBe("GC-000002");
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
    expect(normalizePhone("(555) 123-4567")).toBe("5551234567");
  });

  it("prevents duplicate clients by normalized email", async () => {
    await prisma.client.create({
      data: {
        grantsClientId: "GC-000010",
        email: "dup@example.com",
        emailNormalized: "dup@example.com",
        firstName: "A",
        lastName: "B",
      },
    });

    await expect(
      prisma.client.create({
        data: {
          grantsClientId: "GC-000011",
          email: "dup@example.com",
          emailNormalized: "dup@example.com",
          firstName: "C",
          lastName: "D",
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces role permissions for finance vs file preparer", () => {
    expect(hasPermission(Role.OWNER, "VIEW_FINANCE_DASHBOARD")).toBe(true);
    expect(hasPermission(Role.FILE_PREPARER, "VIEW_FINANCE_DASHBOARD")).toBe(false);
    expect(canAccessFinancialData(Role.FILE_PREPARER)).toBe(false);
    expect(hasPermission(Role.FILE_PREPARER, "VIEW_PAYOUTS")).toBe(false);
    expect(hasPermission(Role.MARKETING, "VIEW_CREDIT_DOCS")).toBe(false);
  });

  it("billing eligibility gates invoice creation after milestone", async () => {
    const service = await prisma.service.create({
      data: {
        code: "TEST_SVC",
        name: "Test Service",
        basePriceCents: 10000,
        billingPolicies: {
          create: {
            type: "AFTER_SERVICE_MILESTONE",
            name: "After milestone",
            amountCents: 10000,
          },
        },
      },
      include: { billingPolicies: true },
    });
    const client = await prisma.client.create({
      data: {
        grantsClientId: "GC-000020",
        email: "bill@example.com",
        emailNormalized: "bill@example.com",
        firstName: "Bill",
        lastName: "Able",
      },
    });
    const cs = await prisma.clientService.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        billingPolicyId: service.billingPolicies[0].id,
        milestones: {
          create: {
            billingPolicyId: service.billingPolicies[0].id,
            name: "Step 1",
            invoiceEligible: false,
          },
        },
      },
      include: { milestones: true },
    });

    expect(cs.milestones[0].invoiceEligible).toBe(false);

    const completed = await prisma.serviceMilestone.update({
      where: { id: cs.milestones[0].id },
      data: {
        isCompleted: true,
        completedAt: new Date(),
        invoiceEligible: true,
        paymentEligible: true,
      },
    });
    expect(completed.invoiceEligible).toBe(true);
  });

  it("mock payment success, failure, refund, and idempotency", async () => {
    const provider = new MockPaymentProvider();

    const ok = await provider.createPayment({
      amountCents: 5000,
      providerCustomerId: "cus_1",
      paymentToken: "tok_ok",
      idempotencyKey: "idem-1",
    });
    expect(ok.status).toBe("SUCCEEDED");

    const again = await provider.createPayment({
      amountCents: 5000,
      providerCustomerId: "cus_1",
      paymentToken: "tok_ok",
      idempotencyKey: "idem-1",
    });
    expect(again.providerTransactionId).toBe(ok.providerTransactionId);

    const fail = await provider.createPayment({
      amountCents: 5000,
      providerCustomerId: "cus_1",
      paymentToken: "fail",
      idempotencyKey: "idem-fail",
      simulateFailure: true,
    });
    expect(fail.status).toBe("FAILED");

    const refund = await provider.refundPayment({
      providerTransactionId: ok.providerTransactionId,
      amountCents: 2000,
      idempotencyKey: "rf-1",
    });
    expect(refund.status).toBe("SUCCEEDED");
    expect(refund.amountCents).toBe(2000);
  });

  it("duplicate webhook events are unique at the data layer", async () => {
    await prisma.webhookEvent.create({
      data: {
        provider: "mock",
        providerEventId: "evt_123",
        eventType: "payment.succeeded",
        payloadJson: "{}",
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    await expect(
      prisma.webhookEvent.create({
        data: {
          provider: "mock",
          providerEventId: "evt_123",
          eventType: "payment.succeeded",
          payloadJson: "{}",
          status: "RECEIVED",
        },
      }),
    ).rejects.toThrow();
  });

  it("duplicate payment transactions blocked by idempotency key and provider txn id", async () => {
    const client = await prisma.client.create({
      data: {
        grantsClientId: "GC-000030",
        email: "pay@example.com",
        emailNormalized: "pay@example.com",
        firstName: "Pay",
        lastName: "Ment",
      },
    });

    await prisma.paymentTransaction.create({
      data: {
        clientId: client.id,
        provider: "mock",
        providerTransactionId: "txn_unique_1",
        idempotencyKey: "pay-idem-1",
        amountCents: 1000,
        status: "SUCCEEDED",
      },
    });

    await expect(
      prisma.paymentTransaction.create({
        data: {
          clientId: client.id,
          provider: "mock",
          providerTransactionId: "txn_unique_2",
          idempotencyKey: "pay-idem-1",
          amountCents: 1000,
          status: "SUCCEEDED",
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.paymentTransaction.create({
        data: {
          clientId: client.id,
          provider: "mock",
          providerTransactionId: "txn_unique_1",
          idempotencyKey: "pay-idem-2",
          amountCents: 1000,
          status: "SUCCEEDED",
        },
      }),
    ).rejects.toThrow();
  });

  it("preserves credit snapshots and separates scoring models", async () => {
    const client = await prisma.client.findFirst({
      where: { grantsClientId: "GC-000030" },
    });
    expect(client).toBeTruthy();

    const snap1 = await prisma.creditSnapshot.create({
      data: {
        clientId: client!.id,
        source: "SMARTCREDIT",
        capturedAt: new Date("2026-06-01"),
        scores: {
          create: {
            clientId: client!.id,
            bureau: CreditBureau.EQUIFAX,
            score: 619,
            scoringModel: "VantageScore 3.0",
            source: "SMARTCREDIT",
            capturedAt: new Date("2026-06-01"),
          },
        },
      },
    });

    const snap2 = await prisma.creditSnapshot.create({
      data: {
        clientId: client!.id,
        source: "SMARTCREDIT",
        capturedAt: new Date("2026-07-01"),
        scores: {
          create: [
            {
              clientId: client!.id,
              bureau: CreditBureau.EQUIFAX,
              score: 638,
              scoringModel: "VantageScore 3.0",
              source: "SMARTCREDIT",
              capturedAt: new Date("2026-07-01"),
            },
            {
              clientId: client!.id,
              bureau: CreditBureau.EXPERIAN,
              score: 701,
              scoringModel: "FICO Score 8",
              source: "EXPERIAN",
              capturedAt: new Date("2026-07-01"),
            },
          ],
        },
      },
    });

    const eqScores = await prisma.creditScore.findMany({
      where: {
        clientId: client!.id,
        bureau: CreditBureau.EQUIFAX,
        scoringModel: "VantageScore 3.0",
      },
      orderBy: { capturedAt: "asc" },
    });
    expect(eqScores).toHaveLength(2);
    expect(eqScores[0].score).toBe(619);
    expect(eqScores[1].score).toBe(638);

    const fico = await prisma.creditScore.findMany({
      where: { clientId: client!.id, scoringModel: "FICO Score 8" },
    });
    expect(fico).toHaveLength(1);
    expect(fico[0].score).toBe(701);
    expect(snap1.id).not.toBe(snap2.id);
  });

  it("timeline events are idempotent by key", async () => {
    const client = await prisma.client.findFirst({
      where: { grantsClientId: "GC-000030" },
    });
    await prisma.clientTimelineEvent.create({
      data: {
        clientId: client!.id,
        eventType: "CLIENT_CREATED",
        title: "Created",
        idempotencyKey: "tl-1",
      },
    });
    await expect(
      prisma.clientTimelineEvent.create({
        data: {
          clientId: client!.id,
          eventType: "CLIENT_CREATED",
          title: "Created again",
          idempotencyKey: "tl-1",
        },
      }),
    ).rejects.toThrow();
  });
});
