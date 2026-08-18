import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getMarketingDashboard } from "@/lib/marketing/dashboard";
import { getOperationsReport } from "@/lib/reports/operations";
import { formatUsd } from "@/lib/payments/dashboard";

export default async function IntelligencePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_MARKETING") && !hasPermission(user.role, "VIEW_OWNER_COMMAND")) {
    return <p>Access denied.</p>;
  }

  const dash = hasPermission(user.role, "VIEW_MARKETING")
    ? await getMarketingDashboard()
    : null;
  const ops = hasPermission(user.role, "VIEW_OWNER_COMMAND")
    ? await getOperationsReport()
    : null;

  return (
    <div>
      <div className="gc-fade-up mb-10">
        <p className="text-[0.7rem] tracking-[0.3em] uppercase text-[var(--gc-gold)] mb-2">
          Grants Intelligence
        </p>
        <h1 className="text-4xl md:text-5xl mb-2">Reports</h1>
        <p className="text-sm text-[var(--gc-muted)]">
          Verified revenue only · attribution fail-closed · no fabricated sources
        </p>
      </div>

      {ops ? (
        <section className="mb-12 gc-fade-up">
          <h2 className="text-2xl mb-4">Verified revenue</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-4">
            {[
              ["Today", formatUsd(ops.revenue.todayCents), `${ops.revenue.todayCount} payments`],
              ["This week", formatUsd(ops.revenue.weekCents), `${ops.revenue.weekCount} payments`],
              ["This month", formatUsd(ops.revenue.monthCents), `${ops.revenue.monthCount} payments`],
              ["Active clients", String(ops.activeClients), "status ACTIVE"],
              ["Unpaid invoices", String(ops.unpaidInvoices.length), "DUE / FAILED"],
              ["Unanswered inbound", String(ops.unansweredInboundThisWeek), "this week"],
            ].map(([label, value, sub]) => (
              <div key={label} className="gc-metric">
                <p className="text-[0.65rem] tracking-[0.18em] uppercase text-[var(--gc-muted)]">
                  {label}
                </p>
                <p className="display text-3xl">{value}</p>
                <p className="text-xs text-[var(--gc-muted)] mt-1">{sub}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--gc-muted)]">
            {ops.revenue.note}. Simulated/mock volume excluded from totals
            {ops.simulatedExcluded.count
              ? ` (${ops.simulatedExcluded.count} mock tx · ${formatUsd(ops.simulatedExcluded.amountCents)})`
              : ""}
            .
          </p>

          <h3 className="text-xl mt-8 mb-3">Who still owes</h3>
          <div className="divide-y divide-[var(--gc-border)]">
            {ops.unpaidInvoices.length === 0 ? (
              <p className="text-sm text-[var(--gc-muted)] py-3">No unpaid invoices.</p>
            ) : (
              ops.unpaidInvoices.map((inv) => (
                <div key={inv.id} className="flex justify-between py-3 text-sm">
                  <span>
                    {inv.client.firstName} {inv.client.lastName} · {inv.client.grantsClientId} ·{" "}
                    {inv.invoiceNumber}
                  </span>
                  <span>{formatUsd(inv.amountCents - inv.amountPaidCents)}</span>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {dash ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12 gc-fade-up-delay">
            {[
              ["Leads", String(dash.leads)],
              ["Consultations", String(dash.consultations)],
              ["Clients", String(dash.clients)],
              ["Conversion", `${(dash.conversionRate * 100).toFixed(0)}%`],
              ["Revenue", formatUsd(dash.revenueCents)],
              ["Collected", formatUsd(dash.collectedRevenueCents)],
            ].map(([label, value]) => (
              <div key={label} className="gc-metric">
                <p className="text-[0.65rem] tracking-[0.18em] uppercase text-[var(--gc-muted)]">
                  {label}
                </p>
                <p className="display text-3xl">{value}</p>
              </div>
            ))}
          </div>

          <section>
            <h2 className="text-2xl mb-4">Revenue by Source</h2>
            {dash.revenueBySource.map((s) => (
              <div
                key={s.source}
                className="flex justify-between py-3 border-b border-[var(--gc-border)]"
              >
                <div>
                  <p className="font-medium">{s.source}</p>
                  <p className="text-xs text-[var(--gc-muted)]">
                    {s.platform} · {s.leads} leads
                  </p>
                </div>
                <p>{formatUsd(s.revenueCents)}</p>
              </div>
            ))}
          </section>
        </>
      ) : null}

      <section className="mt-12">
        <h2 className="text-2xl mb-4">AI Assistance</h2>
        <p className="text-sm text-[var(--gc-muted)] max-w-2xl">
          AI may assist with summaries, prioritization, and explanations. It must never invent
          financial transactions, credit scores, or attribution.
        </p>
      </section>
    </div>
  );
}
