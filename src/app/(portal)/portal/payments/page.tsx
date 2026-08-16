import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatUsd } from "@/lib/payments/dashboard";

export default async function PortalPaymentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const client = await prisma.client.findFirst({
    where: { userId: user.id },
    include: {
      invoices: { orderBy: { createdAt: "desc" } },
      paymentTransactions: { orderBy: { createdAt: "desc" }, take: 20 },
      refunds: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!client) return <p>No profile</p>;

  return (
    <div className="gc-fade-up space-y-8">
      <div>
        <h1 className="text-4xl mb-2">My Payments</h1>
        <p className="text-sm text-[var(--gc-muted)]">Invoices, receipts, and history</p>
      </div>

      <section>
        <h2 className="text-xl mb-3">Invoices</h2>
        {client.invoices.map((inv) => (
          <div key={inv.id} className="flex justify-between py-3 border-b border-[var(--gc-border)]">
            <div>
              <p className="font-medium">{inv.invoiceNumber}</p>
              <p className="text-xs text-[var(--gc-muted)]">{inv.status}</p>
            </div>
            <div className="text-right">
              <p>{formatUsd(inv.amountCents - inv.amountPaidCents)}</p>
              {(inv.status === "DUE" || inv.status === "FAILED") && (
                <Link href={`/pay/${inv.invoiceNumber}`} className="text-[0.65rem] tracking-[0.12em] uppercase text-[var(--gc-gold)]">
                  Pay Securely
                </Link>
              )}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-xl mb-3">Payment History</h2>
        {client.paymentTransactions.map((t) => (
          <div key={t.id} className="flex justify-between py-2 border-b border-[var(--gc-border)] text-sm">
            <span>{t.status}</span>
            <span>{formatUsd(t.amountCents)}</span>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-xl mb-3">Refunds</h2>
        {client.refunds.length === 0 && (
          <p className="text-sm text-[var(--gc-muted)]">No refunds</p>
        )}
        {client.refunds.map((r) => (
          <div key={r.id} className="flex justify-between py-2 border-b border-[var(--gc-border)] text-sm">
            <span>{r.status}</span>
            <span>{formatUsd(r.amountCents)}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
