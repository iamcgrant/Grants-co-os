import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
  });
  const client = await prisma.client.findFirst({
    where: { grantsClientId: "GC-000001" },
  });
  if (!client) throw new Error("Donna not found");

  const existing = await prisma.invoice.findUnique({
    where: { invoiceNumber: "GC-1050" },
  });
  if (existing) {
    console.log(existing.invoiceNumber, existing.id, existing.status);
    await prisma.$disconnect();
    return;
  }

  const inv = await prisma.invoice.create({
    data: {
      invoiceNumber: "GC-1050",
      clientId: client.id,
      status: "DUE",
      amountCents: 14900,
      description: "Monthly Credit Optimization",
      dueAt: new Date(),
      items: {
        create: {
          description: "Monthly Credit Optimization",
          quantity: 1,
          unitCents: 14900,
          totalCents: 14900,
        },
      },
    },
  });
  await prisma.idSequence.update({
    where: { name: "invoice" },
    data: { value: 1050 },
  });
  console.log(inv.invoiceNumber, inv.id);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
