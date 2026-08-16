import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getMarketingDashboard } from "@/lib/marketing/dashboard";
import { formatUsd } from "@/lib/payments/dashboard";

export default async function IntelligencePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_MARKETING")) {
    return <p>Access denied.</p>;
  }

  const dash = await getMarketingDashboard();

  return (
    <div>
      <div className="gc-fade-up mb-10">
        <p className="text-[0.7rem] tracking-[0.3em] uppercase text-[var(--gc-gold)] mb-2">
          Grants Intelligence
        </p>
        <h1 className="text-4xl md:text-5xl mb-2">Attribution</h1>
        <p className="text-sm text-[var(--gc-muted)]">
          Content → Lead → Consultation → Client → Payment → Result
        </p>
      </div>

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
            <p className="text-[0.65rem] tracking-[0.18em] uppercase text-[var(--gc-muted)]">{label}</p>
            <p className="display text-3xl">{value}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-2xl mb-4">Revenue by Source</h2>
        {dash.revenueBySource.map((s) => (
          <div key={s.source} className="flex justify-between py-3 border-b border-[var(--gc-border)]">
            <div>
              <p className="font-medium">{s.source}</p>
              <p className="text-xs text-[var(--gc-muted)]">{s.platform} · {s.leads} leads</p>
            </div>
            <p>{formatUsd(s.revenueCents)}</p>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl mb-4">AI Assistance</h2>
        <p className="text-sm text-[var(--gc-muted)] max-w-2xl">
          AI may assist with summaries, prioritization, and explanations. It must never invent financial transactions,
          silently alter credit records, execute refunds, or make unsupported legal conclusions.
        </p>
      </section>
    </div>
  );
}
