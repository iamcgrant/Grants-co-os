import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { commasLastStepUrl } from "@/lib/payments/commas-checkout-url";
import { listRecordedCommasCheckoutUrls } from "@/lib/payments/payment-requests";
import { InvoiceDocument } from "@/components/pay/InvoiceDocument";
import { RecordCommasCheckoutForm } from "@/components/pay/RecordCommasCheckoutForm";
import { formatUsd } from "@/lib/payments/dashboard";

export default async function StaffInvoicePage({
  params,
}: {
  params: Promise<{ invoiceNumber: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_CLIENT_FINANCIALS")) {
    return <p>Finance access is limited for this role.</p>;
  }

  const { invoiceNumber } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { invoiceNumber },
    include: {
      client: true,
      items: true,
      paymentRequests: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { links: { take: 1, orderBy: { createdAt: "desc" } } },
      },
      transactions: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });

  if (!invoice) {
    return (
      <div>
        <h1 className="text-3xl mb-2">Invoice</h1>
        <p className="text-[var(--gc-muted)]">Invoice {invoiceNumber} was not found.</p>
      </div>
    );
  }

  const request = invoice.paymentRequests[0];
  const lastStepUrl = commasLastStepUrl(request?.links[0]?.url);
  const canPay = hasPermission(user.role, "MANAGE_PAYMENTS");
  const recordedUrls = canPay ? await listRecordedCommasCheckoutUrls() : [];

  return (
    <div className="gc-fade-up space-y-6 max-w-4xl">
      <div>
        <p className="gc-eyebrow mb-2">Grants Pay</p>
        <h1 className="text-3xl md:text-4xl mb-2">Invoice {invoice.invoiceNumber}</h1>
        <p className="text-sm text-[var(--gc-muted)] max-w-2xl">
          Native OS invoice. Commas is the payment backend in spirit — official Fanbasis checkout
          is the last step only. Fanbasis has no API Keys page.
        </p>
      </div>

      <InvoiceDocument
        invoice={{
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          amountCents: invoice.amountCents,
          amountPaidCents: invoice.amountPaidCents,
          description: invoice.description,
          dueAt: invoice.dueAt,
          createdAt: invoice.createdAt,
          clientName: `${invoice.client.firstName} ${invoice.client.lastName}`,
          grantsClientId: invoice.client.grantsClientId,
          clientEmail: invoice.client.email,
          paymentRequestPublicId: request?.publicId || null,
          items: invoice.items,
          lastStepUrl,
          osPayPath: `/pay/${invoice.invoiceNumber}`,
        }}
      />

      <div className="flex flex-wrap gap-3">
        <Link href={`/clients/${invoice.client.grantsClientId}?tab=pay`} className="gc-btn gc-btn-outline">
          Client 360 Pay
        </Link>
        <Link href="/pay" className="gc-btn gc-btn-ghost">
          Grants Pay
        </Link>
      </div>

      {canPay && request && !lastStepUrl ? (
        <RecordCommasCheckoutForm publicId={request.publicId} recordedUrls={recordedUrls} />
      ) : null}

      <section className="gc-card">
        <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-3">
          Payment status
        </p>
        <p className="text-sm">
          Request {request?.publicId || "—"} · {request?.status || invoice.status}
        </p>
        {request?.paidAt ? (
          <p className="text-sm text-[var(--gc-muted)] mt-1">
            Paid {request.paidAt.toLocaleString()}
          </p>
        ) : (
          <p className="text-sm text-[var(--gc-muted)] mt-1">
            Tracked in OS until an official Commas checkout or inbound Grants Pay webhook marks it paid.
          </p>
        )}
      </section>

      {invoice.transactions.length > 0 ? (
        <section className="gc-card">
          <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-3">
            Ledger
          </p>
          <div className="divide-y divide-[var(--gc-border)]">
            {invoice.transactions.map((txn) => (
              <div key={txn.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                <span>
                  {txn.status} · {txn.provider}
                </span>
                <span className="display">{formatUsd(txn.amountCents)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
