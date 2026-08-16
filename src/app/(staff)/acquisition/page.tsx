import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getAcquisitionDashboard } from "@/lib/acquisition/dashboard";
import { ACQUISITION_LOCKS } from "@/lib/acquisition/locks";

function metricText(metric: { status: string; value: unknown; reason?: string }) {
  if (metric.status === "DATA_UNAVAILABLE") return "DATA UNAVAILABLE";
  if (typeof metric.value === "number") {
    return Number.isInteger(metric.value) ? String(metric.value) : metric.value.toFixed(2);
  }
  return "DATA UNAVAILABLE";
}

export default async function AcquisitionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_MARKETING")) {
    return <p>Access denied.</p>;
  }

  const dash = await getAcquisitionDashboard();
  const cards = [
    dash.metrics.newLeadsToday,
    dash.metrics.newLeadsWeek,
    dash.metrics.consultations,
    dash.metrics.pendingPayments,
    dash.metrics.newClients,
    dash.metrics.partnerProspects,
    dash.metrics.activeReferralPartners,
    dash.metrics.partnerReferrals,
    dash.metrics.reactivationLeads,
    dash.metrics.conversionRate,
    dash.metrics.leadsNeedingFollowUp,
  ];

  return (
    <div>
      <div className="gc-fade-up mb-10">
        <p className="text-[0.7rem] tracking-[0.3em] uppercase text-[var(--gc-gold)] mb-2">
          Acquisition command center
        </p>
        <h1 className="text-4xl md:text-5xl mb-2">Partners &amp; consumers</h1>
        <p className="text-sm text-[var(--gc-muted)] max-w-2xl">
          Engine A is referral partners (business rows). Engine B is direct consumers on the
          existing Client master. Missing stamps stay DATA UNAVAILABLE. Friday, welcome, and
          live outreach stay off.
        </p>
      </div>

      <p className="text-xs text-[var(--gc-muted)] mb-8">
        Locks · Friday {String(ACQUISITION_LOCKS.fridayEnabled)} · welcome{" "}
        {String(ACQUISITION_LOCKS.welcomeEnabled)} · cold SMS {String(ACQUISITION_LOCKS.coldSmsEnabled)}{" "}
        · GHL writes {String(ACQUISITION_LOCKS.ghlContactWritesEnabled)}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12 gc-fade-up-delay">
        {cards.map((metric) => (
          <div key={metric.label} className="gc-metric">
            <p className="text-[0.65rem] tracking-[0.18em] uppercase text-[var(--gc-muted)]">
              {metric.label}
            </p>
            <p className="display text-3xl">{metricText(metric)}</p>
            {metric.reason ? (
              <p className="text-xs text-[var(--gc-muted)] mt-2">{metric.reason}</p>
            ) : null}
          </div>
        ))}
      </div>

      <section className="mb-12">
        <h2 className="text-2xl mb-2">By market</h2>
        <p className="text-sm text-[var(--gc-muted)] mb-4">
          Default start set is Charles&apos;s primary cities — never Estill. Rows appear only
          when a Partner, PartnerReferral, or LeadAttribution is stamped. Missing stamps stay
          DATA UNAVAILABLE.
        </p>
        {dash.byMarket.status === "DATA_UNAVAILABLE" ? (
          <p className="text-sm text-[var(--gc-muted)]">{dash.byMarket.reason}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.65rem] tracking-[0.18em] uppercase text-[var(--gc-muted)]">
                  <th className="pb-3 pr-4">Market</th>
                  <th className="pb-3 pr-4">Prospects</th>
                  <th className="pb-3 pr-4">Replies</th>
                  <th className="pb-3 pr-4">Meetings</th>
                  <th className="pb-3 pr-4">Referrals</th>
                  <th className="pb-3 pr-4">Converted</th>
                  <th className="pb-3">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {dash.byMarket.rows.map((row) => (
                  <tr key={row.market} className="border-t border-white/10">
                    <td className="py-3 pr-4">{row.label}</td>
                    <td className="py-3 pr-4">{metricText(row.prospectsFound)}</td>
                    <td className="py-3 pr-4">{metricText(row.replies)}</td>
                    <td className="py-3 pr-4">{metricText(row.meetings)}</td>
                    <td className="py-3 pr-4">{metricText(row.referrals)}</td>
                    <td className="py-3 pr-4">{metricText(row.clientsConverted)}</td>
                    <td className="py-3">{metricText(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl mb-4">Revenue by Source</h2>
        <p className="text-sm text-[var(--gc-muted)]">
          {dash.metrics.revenueBySource.status === "DATA_UNAVAILABLE"
            ? dash.metrics.revenueBySource.reason
            : "Stamped LeadAttribution rows with verified payment facts."}
        </p>
      </section>
    </div>
  );
}
