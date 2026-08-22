import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";
import {
  isOfficialCommasCheckoutUrl,
  parseOfficialCommasCheckoutUrl,
  STAFF_RECORDED_COMMAS_SESSION,
} from "@/lib/payments/commas-checkout-url";
import { commasHonestHealth } from "@/lib/payments/commas-config";
import { grantsPayInboundContract } from "@/lib/payments/inbound-webhook";

const testDb = path.join(process.cwd(), "prisma", "test-commas-manual.db");

describe("manual Commas invoices without COMMAS_API_KEY", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.PAYMENT_PROVIDER = "mock";
    process.env.AUTH_SECRET = "test-secret-for-vitest-only-32chars!!";
    process.env.GRANTS_PAY_INBOUND_WEBHOOK_SECRET = "inbound_test_secret_32chars_min!!";
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
    await prisma.paymentRequestNote.deleteMany();
    await prisma.paymentLink.deleteMany();
    await prisma.paymentRequest.deleteMany();
    await prisma.paymentAttempt.deleteMany();
    await prisma.refund.deleteMany();
    await prisma.paymentTransaction.deleteMany();
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

  it("accepts only official Fanbasis checkout hosts and rejects scrape-shaped URLs", () => {
    expect(isOfficialCommasCheckoutUrl("https://www.fanbasis.com/grant/credit-opt")).toBe(true);
    expect(parseOfficialCommasCheckoutUrl("https://qa.dev-fan-basis.com/pay/abc")).toMatch(
      /qa\.dev-fan-basis\.com/,
    );
    expect(isOfficialCommasCheckoutUrl("http://www.fanbasis.com/x")).toBe(false);
    expect(isOfficialCommasCheckoutUrl("https://evil.example/scrape")).toBe(false);
    expect(() => parseOfficialCommasCheckoutUrl("https://evil.example/scrape")).toThrow(/official/i);
  });

  it("creates an OS invoice without COMMAS_API_KEY and records a pasted checkout", async () => {
    vi.resetModules();
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    const { createPaymentRequest } = await import("@/lib/payments/payment-requests");
    const { nextGrantsClientId } = await import("@/lib/clients/identity");
    const db = await import("@/lib/db/prisma");
    prisma = db.prisma;

    const client = await prisma.client.create({
      data: {
        grantsClientId: await nextGrantsClientId(),
        email: "invoice@example.com",
        emailNormalized: "invoice@example.com",
        firstName: "Ivy",
        lastName: "Voice",
      },
    });

    const created = await createPaymentRequest({
      clientId: client.id,
      amountCents: 75000,
      serviceName: "Credit Optimization",
      commasCheckoutUrl: "https://www.fanbasis.com/grant/credit-opt",
    });

    expect(created.invoice.status).toBe("DUE");
    expect(created.request.provider).toBe("commas");
    expect(created.request.status).toBe("PENDING");
    expect(created.link.url).toBe("https://www.fanbasis.com/grant/credit-opt");
    expect(created.link.osPayPath).toContain("/pay/");

    const link = await prisma.paymentLink.findFirstOrThrow({
      where: { paymentRequestId: created.request.id },
    });
    expect(link.provider).toBe("commas");
    expect(link.providerSessionId).toBe(STAFF_RECORDED_COMMAS_SESSION);

    const { collectSystemHealth } = await import("@/lib/system/health");
    const health = await collectSystemHealth();
    const commas = health.components.find((c) => c.component === "commas");
    expect(commas?.status).toBe("CONNECTED");
    expect(commas?.detail).toMatch(/checkout recorded/i);
  });

  it("attaches an official checkout later and marks paid via inbound webhook", async () => {
    vi.resetModules();
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    const { createPaymentRequest, recordCommasCheckoutUrl } = await import(
      "@/lib/payments/payment-requests"
    );
    const { applyGrantsPayInboundPayment } = await import("@/lib/payments/inbound-webhook");
    const { nextGrantsClientId } = await import("@/lib/clients/identity");
    const db = await import("@/lib/db/prisma");
    prisma = db.prisma;

    const client = await prisma.client.create({
      data: {
        grantsClientId: await nextGrantsClientId(),
        email: "later@example.com",
        emailNormalized: "later@example.com",
        firstName: "Later",
        lastName: "Pay",
      },
    });

    const created = await createPaymentRequest({
      clientId: client.id,
      amountCents: 50000,
      serviceName: "Credit Optimization",
    });
    expect(created.link.url).not.toMatch(/fanbasis\.com/);

    const recorded = await recordCommasCheckoutUrl({
      paymentRequestPublicId: created.request.publicId,
      url: "https://www.fanbasis.com/grant/product",
    });
    expect(recorded.link.url).toMatch(/fanbasis\.com/);

    const first = await applyGrantsPayInboundPayment(
      JSON.stringify({
        event: "payment.succeeded",
        paymentRequestPublicId: created.request.publicId,
        invoiceNumber: created.invoice.invoiceNumber,
        amountCents: 50000,
        providerTransactionId: "zap_txn_1",
        source: "zapier",
      }),
    );
    expect(first.duplicate).toBe(false);
    expect(first.applied?.effect).toBe("payment_applied");

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: created.invoice.id } });
    expect(invoice.status).toBe("SUCCEEDED");
    const request = await prisma.paymentRequest.findUniqueOrThrow({
      where: { id: created.request.id },
    });
    expect(request.status).toBe("PAID");

    const second = await applyGrantsPayInboundPayment(
      JSON.stringify({
        event: "payment.succeeded",
        paymentRequestPublicId: created.request.publicId,
        invoiceNumber: created.invoice.invoiceNumber,
        amountCents: 50000,
        providerTransactionId: "zap_txn_1",
        source: "zapier",
      }),
    );
    expect(second.duplicate).toBe(true);
  });

  it("never marks Commas CONNECTED from key absence; recorded checkout or inbound webhook can CONNECT", () => {
    delete process.env.COMMAS_API_KEY;
    const missing = commasHonestHealth();
    expect(missing.status).not.toBe("CONNECTED");
    expect(missing.detail).toMatch(/no API Keys page|never CONNECTED/i);

    const recorded = commasHonestHealth({
      lastCheckoutAt: "2026-08-22T12:00:00.000Z",
    });
    expect(recorded.status).toBe("CONNECTED");
    expect(recorded.detail).toMatch(/checkout recorded/i);

    const inbound = commasHonestHealth({
      lastWebhookAt: "2026-08-22T13:00:00.000Z",
    });
    expect(inbound.status).toBe("CONNECTED");
    expect(inbound.detail).toMatch(/webhook processed/i);
  });

  it("documents the inbound webhook path and keeps Hobby daily cron", () => {
    const contract = grantsPayInboundContract();
    expect(contract.path).toBe("/api/webhooks/grants-pay");
    expect(contract.payload.event).toBe("payment.succeeded");
    expect(contract.payload.paymentRequestPublicId).toMatch(/^GP-/);

    const cron = fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8");
    expect(cron).toMatch(/"path": "\/api\/automations\/run"/);
    expect(cron).toMatch(/"0 12 \* \* \*"/);

    const form = fs.readFileSync(
      path.join(process.cwd(), "src/components/pay/CreatePaymentRequestForm.tsx"),
      "utf8",
    );
    expect(form).toContain("use client");
    expect(form).not.toContain("@/lib/db/prisma");
    expect(form).not.toContain("from \"pg\"");

    const invoiceUi = fs.readFileSync(
      path.join(process.cwd(), "src/components/pay/InvoiceDocument.tsx"),
      "utf8",
    );
    expect(invoiceUi).not.toContain("@/lib/db/prisma");
    expect(invoiceUi).not.toContain("from \"pg\"");

    const staffInvoice = fs.readFileSync(
      path.join(process.cwd(), "src/app/(staff)/pay/invoices/[invoiceNumber]/page.tsx"),
      "utf8",
    );
    expect(staffInvoice).toMatch(/InvoiceDocument/);
    expect(staffInvoice).toMatch(/RecordCommasCheckoutForm/);
  });
});
