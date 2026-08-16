import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { chargeInvoice, refundTransaction } from "../src/lib/payments/service";
import { resetPaymentProviderCache } from "../src/lib/payments/provider";

async function main() {
  resetPaymentProviderCache();
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
  });

  await prisma.invoice.update({
    where: { invoiceNumber: "GC-1050" },
    data: { status: "DUE", amountPaidCents: 0 },
  });
  await prisma.$disconnect();

  // Use app singleton path — re-import after env is set
  const invoice = await (await import("../src/lib/db/prisma")).prisma.invoice.findUniqueOrThrow({
    where: { invoiceNumber: "GC-1050" },
  });

  const paid = await chargeInvoice({
    invoiceId: invoice.id,
    paymentToken: "tok_ok",
    idempotencyKey: `demo-success-1050-${Date.now()}`,
  });
  console.log("charge", paid.transaction.status, paid.duplicate);

  const refunded = await refundTransaction({
    transactionId: paid.transaction.id,
    amountCents: 4900,
    reason: "Demo partial refund",
    idempotencyKey: `demo-refund-1050-${Date.now()}`,
  });
  console.log("refund", refunded.refund.status, refunded.refund.amountCents, refunded.duplicate);

  // restore a due invoice for UI demo
  const { prisma: db } = await import("../src/lib/db/prisma");
  await db.invoice.create({
    data: {
      invoiceNumber: "GC-1051",
      clientId: invoice.clientId,
      status: "DUE",
      amountCents: 75000,
      description: "Credit Optimization Service",
      dueAt: new Date(),
      items: {
        create: {
          description: "Credit Optimization Service",
          quantity: 1,
          unitCents: 75000,
          totalCents: 75000,
        },
      },
    },
  });
  console.log("demo invoice ready: GC-1051");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
