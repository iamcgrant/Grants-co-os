import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ invoiceNumber: string }> },
) {
  const { invoiceNumber } = await ctx.params;
  const invoice = await prisma.invoice.findUnique({
    where: { invoiceNumber },
    include: {
      client: {
        select: {
          grantsClientId: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      items: true,
      clientService: { include: { service: true } },
    },
  });

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      amountCents: invoice.amountCents,
      amountPaidCents: invoice.amountPaidCents,
      description: invoice.description,
      dueAt: invoice.dueAt,
      client: invoice.client,
      serviceName: invoice.clientService?.service.name || invoice.description,
      items: invoice.items,
    },
  });
}
