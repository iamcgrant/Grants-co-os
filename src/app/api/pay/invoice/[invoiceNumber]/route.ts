import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthorizeNetPublicCheckoutConfig } from "@/lib/payments/authorize-net-config";
import { commasPublicStatus } from "@/lib/payments/commas-config";
import { commasLastStepUrl } from "@/lib/payments/commas-checkout-url";
import { getPaymentProvider } from "@/lib/payments/provider";

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
      paymentLinks: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      paymentRequests: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const acceptJs = getAuthorizeNetPublicCheckoutConfig();
  const provider = getPaymentProvider();
  const commas = commasPublicStatus();
  const activeLink = invoice.paymentLinks[0];

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
      paymentRequestPublicId: invoice.paymentRequests[0]?.publicId || null,
    },
    checkout: {
      provider: provider.name,
      acceptJs,
      commas: {
        enabled: Boolean(commasLastStepUrl(activeLink?.url)) || (commas.configured && provider.name === "commas"),
        environment: commas.environment,
        paymentLinkUrl:
          commasLastStepUrl(activeLink?.url) ||
          (provider.name === "commas" && activeLink?.url && !activeLink.url.startsWith("/")
            ? activeLink.url
            : null),
      },
    },
  });
}
