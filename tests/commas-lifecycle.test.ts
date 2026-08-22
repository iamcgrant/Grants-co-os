import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";

const testDb = path.join(process.cwd(), "prisma", "test-commas-lifecycle.db");

describe("Commas payment + lifecycle", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.PAYMENT_PROVIDER = "mock";
    process.env.COMMAS_WEBHOOK_SECRET =
      "whsk_test_secret_0123456789abcdef0123456789abcdef";
    process.env.AUTH_SECRET = "test-secret-for-vitest-only-32chars!!";
    delete process.env.COMMAS_API_KEY;
    resetSqliteFromSchema(testDb);

    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    vi.resetModules();

    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
  });

  beforeEach(async () => {
    await prisma.automationRun.deleteMany();
    await prisma.onboardingToken.deleteMany();
    await prisma.onboardingItem.deleteMany();
    await prisma.paymentRequestNote.deleteMany();
    await prisma.paymentLink.deleteMany();
    await prisma.paymentRequest.deleteMany();
    await prisma.paymentAttempt.deleteMany();
    await prisma.refund.deleteMany();
    await prisma.paymentTransaction.deleteMany();
    await prisma.paymentMethod.deleteMany();
    await prisma.paymentCustomer.deleteMany();
    await prisma.webhookEvent.deleteMany();
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.clientTimelineEvent.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.task.deleteMany();
    await prisma.clientAssignment.deleteMany();
    await prisma.client.deleteMany();
    await prisma.idSequence.deleteMany();
    process.env.PAYMENT_PROVIDER = "mock";
    delete process.env.COMMAS_API_KEY;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it("creates a payment request with OS pay link under mock provider", async () => {
    vi.resetModules();
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    const { createPaymentRequest } = await import("@/lib/payments/payment-requests");
    const { nextGrantsClientId } = await import("@/lib/clients/identity");
    const db = await import("@/lib/db/prisma");
    prisma = db.prisma;

    const grantsClientId = await nextGrantsClientId();
    const client = await prisma.client.create({
      data: {
        grantsClientId,
        email: "paytest@example.com",
        emailNormalized: "paytest@example.com",
        firstName: "Pay",
        lastName: "Test",
        phone: "5551112222",
        phoneNormalized: "5551112222",
      },
    });

    const result = await createPaymentRequest({
      clientId: client.id,
      amountCents: 75000,
      serviceName: "Credit Optimization",
      sendEmail: true,
    });

    expect(result.request.publicId).toMatch(/^GP-/);
    expect(result.invoice.status).toBe("DUE");
    expect(result.link.osPayPath).toContain("/pay/");
    expect(result.delivery.emailQueued).toBe(true);

    const form = fs.readFileSync(path.join(process.cwd(), "src/components/pay/CreatePaymentRequestForm.tsx"), "utf8");
    expect(form).toMatch(/lockedClientId/);
    expect(form).toMatch(/Create payment request link/);
    const client360 = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/clients/[id]/page.tsx"), "utf8");
    expect(client360).toMatch(/CreatePaymentRequestForm/);
    expect(client360).toMatch(/commasHonestHealth/);

    const queued = await prisma.automationRun.findFirst({
      where: { kind: "PAYMENT_LINK_EMAIL" },
    });
    expect(queued?.status).toBe("QUEUED");
  });

  it("applies Commas webhook payment.succeeded with idempotency", async () => {
    vi.resetModules();
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;

    process.env.PAYMENT_PROVIDER = "mock";
    const { createPaymentRequest } = await import("@/lib/payments/payment-requests");
    const { nextGrantsClientId } = await import("@/lib/clients/identity");
    const db = await import("@/lib/db/prisma");
    prisma = db.prisma;

    const grantsClientId = await nextGrantsClientId();
    const client = await prisma.client.create({
      data: {
        grantsClientId,
        email: "webhook@example.com",
        emailNormalized: "webhook@example.com",
        firstName: "Web",
        lastName: "Hook",
      },
    });

    const created = await createPaymentRequest({
      clientId: client.id,
      amountCents: 50000,
      serviceName: "Credit Optimization",
    });

    process.env.PAYMENT_PROVIDER = "commas";
    process.env.COMMAS_API_KEY = "test_key";
    process.env.COMMAS_ENVIRONMENT = "sandbox";
    process.env.COMMAS_LIVE_CHARGES = "false";

    vi.resetModules();
    delete g.prisma;
    const { resetPaymentProviderCache } = await import("@/lib/payments/provider");
    resetPaymentProviderCache();
    const { processWebhook } = await import("@/lib/payments/service");
    const db2 = await import("@/lib/db/prisma");
    prisma = db2.prisma;

    const payload = JSON.stringify({
      id: "evt_test_1",
      type: "payment.succeeded",
      data: {
        id: "txn_commas_1",
        amount_cents: 50000,
        metadata: {
          invoice_id: created.invoice.id,
          payment_request_public_id: created.request.publicId,
        },
      },
    });
    const signature = createHmac("sha256", process.env.COMMAS_WEBHOOK_SECRET!)
      .update(payload, "utf8")
      .digest("hex");

    const first = await processWebhook(payload, { "x-webhook-signature": signature });
    expect(first.duplicate).toBe(false);
    expect((first as { applied?: { effect?: string } }).applied?.effect).toBe("payment_applied");

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: created.invoice.id } });
    expect(invoice.status).toBe("SUCCEEDED");
    expect(invoice.amountPaidCents).toBe(50000);

    const second = await processWebhook(payload, { "x-webhook-signature": signature });
    expect(second.duplicate).toBe(true);

    const txnCount = await prisma.paymentTransaction.count({
      where: { invoiceId: created.invoice.id },
    });
    expect(txnCount).toBe(1);
  });

  it("runs payment-completed automation to issue onboarding token", async () => {
    vi.resetModules();
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    process.env.PAYMENT_PROVIDER = "mock";

    const { chargeInvoice } = await import("@/lib/payments/service");
    const { drainAutomationQueue } = await import("@/lib/automations/engine");
    const { nextGrantsClientId, nextInvoiceNumber } = await import("@/lib/clients/identity");
    const { resetPaymentProviderCache } = await import("@/lib/payments/provider");
    resetPaymentProviderCache();
    const db = await import("@/lib/db/prisma");
    prisma = db.prisma;

    const grantsClientId = await nextGrantsClientId();
    const client = await prisma.client.create({
      data: {
        grantsClientId,
        email: "intake@example.com",
        emailNormalized: "intake@example.com",
        firstName: "Donna",
        lastName: "James",
      },
    });
    const invoiceNumber = await nextInvoiceNumber();
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId: client.id,
        status: "DUE",
        amountCents: 75000,
        description: "Credit Optimization",
      },
    });

    const charged = await chargeInvoice({
      invoiceId: invoice.id,
      paymentToken: "tok_visa_4242",
      idempotencyKey: `test-charge-${invoice.id}`,
    });
    expect(charged.transaction.status).toBe("SUCCEEDED");

    await drainAutomationQueue(20);

    const token = await prisma.onboardingToken.findFirst({ where: { clientId: client.id } });
    expect(token).toBeTruthy();
    expect(token?.email).toBe("intake@example.com");

    const onboarding = await prisma.onboardingItem.findMany({ where: { clientId: client.id } });
    expect(onboarding.length).toBeGreaterThan(0);
  });
});
