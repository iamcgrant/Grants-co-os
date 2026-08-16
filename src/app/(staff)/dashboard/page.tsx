import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getFinanceDashboard, formatUsd } from "@/lib/payments/dashboard";
import { prisma } from "@/lib/db/prisma";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canFinance = hasPermission(user.role, "VIEW_FINANCE_DASHBOARD");
  const finance = canFinance ? await getFinanceDashboard() : null;

  const recentInvoices = canFinance
    ? await prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          client: { select: { grantsClientId: true, firstName: true, lastName: true } },
        },
      })
    : [];

  const metrics = finance
    ? [
        { label: "Collected Today", value: formatUsd(finance.collectedTodayCents) },
        { label: "Collected This Week", value: formatUsd(finance.collectedWeekCents) },
        { label: "Collected This Month", value: formatUsd(finance.collectedMonthCents) },
        { label: "Outstanding", value: formatUsd(finance.outstandingCents) },
        { label: "Failed Payments", value: formatUsd(finance.failedPaymentsCents) },
        { label: "Pending Settlement", value: formatUsd(finance.pendingSettlementCents) },
        { label: "Refunds (Month)", value: formatUsd(finance.refundsMonthCents) },
        { label: "Chargebacks Open", value: formatUsd(finance.chargebacksOpenCents) },
        { label: "Net Processed", value: formatUsd(finance.netProcessedCents) },
        { label: "Payouts Paid", value: formatUsd(finance.payoutsPaidCents) },
      ]
    : [];

  return (
    <div>
      <div className="gc-fade-up mb-10">
        <p className="gc-eyebrow mb-2">Grants Pay</p>
        <h1 className="text-4xl md:text-5xl mb-2">Financial Health</h1>
        <p className="text-[var(--gc-muted)] text-sm max-w-xl leading-relaxed">
          Payment success, settlement, and payouts are tracked separately. Bank deposits require processor reconciliation.
        </p>
      </div>

      {!canFinance && (
        <p className="text-[var(--gc-muted)]">
          Your role does not include finance dashboard access.
        </p>
      )}

      {finance && (
        <>
          <div className="gc-fade-up-delay grid md:grid-cols-2 gap-x-12">
            {metrics.map((m) => (
              <div key={m.label} className="gc-metric">
                <p className="text-[0.65rem] tracking-[0.2em] uppercase text-[var(--gc-muted)] mb-1">
                  {m.label}
                </p>
                <p className="display text-3xl md:text-4xl">{m.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 text-xs text-[var(--gc-muted)] space-y-1 gc-fade-up-delay-2">
            <p>{finance.notes.collected}</p>
            <p>{finance.notes.settled}</p>
            <p>{finance.notes.payout}</p>
          </div>

          <section className="mt-12">
            <div className="flex items-end justify-between mb-4">
              <h2 className="text-2xl">Recent Invoices</h2>
              <Link href="/clients" className="text-[0.7rem] tracking-[0.16em] uppercase text-[var(--gc-gold)]">
                View clients
              </Link>
            </div>
            <div className="divide-y divide-[var(--gc-border)]">
              {recentInvoices.map((inv) => (
                <div key={inv.id} className="py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {inv.client.firstName} {inv.client.lastName}
                    </p>
                    <p className="text-xs text-[var(--gc-muted)]">
                      {inv.invoiceNumber} · {inv.client.grantsClientId} · {inv.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="display text-xl">{formatUsd(inv.amountCents)}</p>
                    {inv.status === "DUE" || inv.status === "FAILED" ? (
                      <Link
                        href={`/pay/${inv.invoiceNumber}`}
                        className="text-[0.65rem] tracking-[0.14em] uppercase text-[var(--gc-gold)]"
                      >
                        Open Grants Pay
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
