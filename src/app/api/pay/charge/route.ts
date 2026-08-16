import { NextResponse } from "next/server";
import { z } from "zod";
import { chargeInvoice } from "@/lib/payments/service";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";

const schema = z.object({
  invoiceId: z.string(),
  paymentToken: z.string().min(1),
  idempotencyKey: z.string().min(8),
  simulateFailure: z.boolean().optional(),
});

/**
 * Grants Pay checkout charge.
 * Uses processor tokens only — never raw PAN/CVV through our servers.
 */
export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const user = await getCurrentUser();

    const invoice = await prisma.invoice.findUnique({
      where: { id: body.invoiceId },
      include: { client: true },
    });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    // Clients may only pay their own invoices; staff with permission also allowed
    if (user?.role === "CLIENT" && user.id) {
      const client = await prisma.client.findFirst({ where: { userId: user.id } });
      if (!client || client.id !== invoice.clientId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const result = await chargeInvoice({
      invoiceId: body.invoiceId,
      paymentToken: body.paymentToken,
      idempotencyKey: body.idempotencyKey,
      actorId: user?.id,
      simulateFailure: body.simulateFailure,
    });

    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id: body.invoiceId },
    });

    return NextResponse.json({
      ...result,
      invoice: updatedInvoice,
      receipt:
        result.transaction.status === "SUCCEEDED"
          ? {
              receiptNumber: `RCPT-${result.transaction.id.slice(-8).toUpperCase()}`,
              amountCents: result.transaction.amountCents,
              invoiceNumber: invoice.invoiceNumber,
              paidAt: new Date().toISOString(),
              clientName: `${invoice.client.firstName} ${invoice.client.lastName}`,
            }
          : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Payment failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
