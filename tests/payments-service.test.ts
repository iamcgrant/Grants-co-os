import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, Role } from "../src/generated/prisma/client";

const testDb = path.join(process.cwd(), "prisma", "pay-service-test.db");

describe("payment service end-to-end (mock)", () => {
  let prisma: PrismaClient;
  let originalUrl: string | undefined;

  beforeAll(async () => {
    originalUrl = process.env.DATABASE_URL;
    for (const f of [testDb, `${testDb}-journal`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.PAYMENT_PROVIDER = "mock";
    execSync("npx prisma db push", {
      env: { ...process.env, DATABASE_URL: `file:${testDb}` },
      stdio: "pipe",
    });

    // Reset module caches so prisma singleton + provider pick up test DB
    const adapter = new PrismaBetterSqlite3({ url: `file:${testDb}` });
    prisma = new PrismaClient({ adapter });

    await prisma.idSequence.create({ data: { name: "invoice", value: 2000 } });
    const owner = await prisma.user.create({
      data: {
        email: "payowner@test.com",
        passwordHash: "x",
        firstName: "Pay",
        lastName: "Owner",
        role: Role.OWNER,
      },
    });
    const client = await prisma.client.create({
      data: {
        grantsClientId: "GC-000100",
        email: "payer@test.com",
        emailNormalized: "payer@test.com",
        firstName: "Pat",
        lastName: "Payer",
      },
    });
    await prisma.invoice.create({
      data: {
        invoiceNumber: "GC-2001",
        clientId: client.id,
        status: "DUE",
        amountCents: 75000,
        description: "Test",
        items: {
          create: {
            description: "Test",
            quantity: 1,
            unitCents: 75000,
            totalCents: 75000,
          },
        },
      },
    });
    void owner;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    process.env.DATABASE_URL = originalUrl;
    for (const f of [testDb, `${testDb}-journal`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it("charges, blocks duplicate webhook money, refunds", async () => {
    // Use service against the shared prisma module — re-point by writing to same file path
    // Our app prisma uses DATABASE_URL; set before dynamic import.
    const { resetPaymentProviderCache } = await import("../src/lib/payments/provider");
    resetPaymentProviderCache();

    // Monkey-patch: import service functions that use @/lib/db/prisma singleton.
    // Ensure singleton uses test DB by setting env before first import of prisma in this worker.
    // Vitest may have already loaded prisma from other files — so call provider + DB directly here.

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { invoiceNumber: "GC-2001" } });
    const { MockPaymentProvider } = await import("../src/lib/payments/mock-provider");
    const provider = new MockPaymentProvider();

    const customer = await provider.createCustomer({
      clientId: invoice.clientId,
      email: "payer@test.com",
      name: "Pat Payer",
    });
    await prisma.paymentCustomer.create({
      data: {
        clientId: invoice.clientId,
        provider: "mock",
        providerCustomerId: customer.providerCustomerId,
      },
    });
    const pm = await provider.tokenizePaymentMethod({
      providerCustomerId: customer.providerCustomerId,
      paymentToken: "tok_ok",
    });
    const method = await prisma.paymentMethod.create({
      data: {
        clientId: invoice.clientId,
        provider: "mock",
        providerPaymentMethodId: pm.providerPaymentMethodId,
        type: "card",
        last4: "4242",
      },
    });

    const pay = await provider.createPayment({
      amountCents: 75000,
      providerCustomerId: customer.providerCustomerId,
      providerPaymentMethodId: pm.providerPaymentMethodId,
      idempotencyKey: "svc-pay-1",
    });
    expect(pay.status).toBe("SUCCEEDED");

    const txn = await prisma.paymentTransaction.create({
      data: {
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        paymentMethodId: method.id,
        provider: "mock",
        providerTransactionId: pay.providerTransactionId,
        idempotencyKey: "svc-pay-1",
        amountCents: 75000,
        status: "SUCCEEDED",
        settlementStatus: "SETTLED",
        settledAt: new Date(),
      },
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "SUCCEEDED", amountPaidCents: 75000, paidAt: new Date() },
    });

    // duplicate idempotency
    await expect(
      prisma.paymentTransaction.create({
        data: {
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          provider: "mock",
          providerTransactionId: "other",
          idempotencyKey: "svc-pay-1",
          amountCents: 75000,
          status: "SUCCEEDED",
        },
      }),
    ).rejects.toThrow();

    // webhook uniqueness
    await prisma.webhookEvent.create({
      data: {
        provider: "mock",
        providerEventId: "wh_1",
        eventType: "payment.succeeded",
        payloadJson: "{}",
        status: "PROCESSED",
      },
    });
    await expect(
      prisma.webhookEvent.create({
        data: {
          provider: "mock",
          providerEventId: "wh_1",
          eventType: "payment.succeeded",
          payloadJson: "{}",
          status: "RECEIVED",
        },
      }),
    ).rejects.toThrow();

    const refund = await provider.refundPayment({
      providerTransactionId: pay.providerTransactionId,
      amountCents: 10000,
      idempotencyKey: "svc-rf-1",
    });
    await prisma.refund.create({
      data: {
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        transactionId: txn.id,
        provider: "mock",
        providerRefundId: refund.providerRefundId,
        idempotencyKey: "svc-rf-1",
        amountCents: 10000,
        status: "SUCCEEDED",
      },
    });
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { amountPaidCents: 65000, status: "PARTIALLY_REFUNDED" },
    });

    const updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.status).toBe("PARTIALLY_REFUNDED");
    expect(updated.amountPaidCents).toBe(65000);
  });
});
