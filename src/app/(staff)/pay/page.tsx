import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getFinanceDashboard, formatUsd } from "@/lib/payments/dashboard";
import { prisma } from "@/lib/db/prisma";

export default async function GrantsPayPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_FINANCE_DASHBOARD")) {
    return (
      <div>
        <h1 className="text-3xl mb-2">Grants Pay</h1>
        <p className="text-[var(--gc-muted)]">Finance access is limited for this role.</p>
      </div>
    );
  }

  const { filter } = await searchParams;
  const finance = await getFinanceDashboard();
  const transactions = await prisma.paymentTransaction.findMany({
    where: filter === "failed" ? { status: "FAILED" } : undefined,
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      client: { select: { grantsClientId: true, firstName: true, lastName: true } },
      invoice: { select: { invoiceNumber: true, description: true } },
      refunds: true,
      disputes: true,
      payouts: true,
    },
  });

  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { client: { select: { grantsClientId: true, firstName: true, lastName: true } } },
  });

  return (
    <div className="gc-fade-up">
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="gc-eyebrow mb-2">Proprietary finance module</p>
          <h1 className="text-4xl md:text-5xl mb-2">Grants Pay</h1>
          <p className="gc-section-sub mb-0 max-w-2xl">
            Authorization, settlement, and payout are separate states. A successful charge is not a bank deposit.
          </p>
        </div>
        <Link href="/home" className="gc-btn gc-btn-outline">
          Command Center
        </Link>
      </div>

      <div className="gc-grid-dense gc-grid-dense-4 mb-10">
        {[
          ["Collected today", finance.collectedTodayCents],
          ["Collected week", finance.collectedWeekCents],
          ["Collected month", finance.collectedMonthCents],
          ["Outstanding", finance.outstandingCents],
          ["Failed", finance.failedPaymentsCents],
          ["Pending settlement", finance.pendingSettlementCents],
          ["Refunds month", finance.refundsMonthCents],
          ["Chargebacks open", finance.chargebacksOpenCents],
          ["Net processed", finance.netProcessedCents],
          ["Payouts paid", finance.payoutsPaidCents],
        ].map(([label, cents]) => (
          <div key={label as string} className="gc-card">
            <p className="text-[0.62rem] tracking-[0.16em] uppercase text-[var(--gc-muted)] mb-2">
              {label as string}
            </p>
            <p className="display text-2xl">{formatUsd(cents as number)}</p>
          </div>
        ))}
      </div>

      <section className="mb-10">
        <h2 className="text-2xl mb-4">Payment ledger</h2>
        <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
          {transactions.map((t) => (
            <div key={t.id} className="py-4 grid md:grid-cols-[1.2fr_1fr_auto] gap-3 items-start">
              <div>
                <p className="font-medium">
                  {t.client.firstName} {t.client.lastName}
                </p>
                <p className="text-xs text-[var(--gc-muted)]">
                  {t.client.grantsClientId}
                  {t.invoice ? ` · ${t.invoice.invoiceNumber}` : ""}
                  {t.invoice?.description ? ` · ${t.invoice.description}` : ""}
                </p>
              </div>
              <div className="text-sm space-y-1">
                <p>
                  Status <span className="gc-status">{t.status}</span>
                </p>
                <p className="text-[var(--gc-muted)]">
                  Settlement {t.settlementStatus} · Payout {t.payoutStatus}
                </p>
                {t.refunds.length > 0 && (
                  <p className="text-[var(--gc-muted)]">Refunds {t.refunds.length}</p>
                )}
                {t.disputes.length > 0 && (
                  <p className="text-[var(--gc-danger)]">Disputes {t.disputes.length}</p>
                )}
              </div>
              <div className="text-right">
                <p className="display text-2xl">{formatUsd(t.amountCents)}</p>
                <Link
                  href={`/clients/${t.client.grantsClientId}`}
                  className="text-[0.65rem] tracking-[0.12em] uppercase text-[var(--gc-ice)]"
                >
                  Client 360
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl mb-4">Invoices</h2>
        <div className="divide-y divide-[var(--gc-border)]">
          {invoices.map((inv) => (
            <div key={inv.id} className="py-3 flex justify-between gap-4">
              <div>
                <p className="font-medium">
                  {inv.client.firstName} {inv.client.lastName} · {inv.invoiceNumber}
                </p>
                <p className="text-xs text-[var(--gc-muted)]">{inv.status}</p>
              </div>
              <div className="text-right">
                <p>{formatUsd(inv.amountCents)}</p>
                {(inv.status === "DUE" || inv.status === "FAILED") && (
                  <Link href={`/pay/${inv.invoiceNumber}`} className="text-[0.65rem] uppercase tracking-wider text-[var(--gc-gold)]">
                    Collect
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
