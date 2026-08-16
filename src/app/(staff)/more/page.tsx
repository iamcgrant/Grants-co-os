import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";

export default async function MorePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const integrations = await prisma.integrationConnection.findMany({ orderBy: { provider: "asc" } });
  const ownerReviews = await prisma.client.findMany({
    where: { nextActionOwner: "CHARLES" },
    take: 10,
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">Tools & oversight</p>
      <h1 className="text-4xl mb-2">More</h1>
      <p className="gc-section-sub">Intelligence, system health, owner review, and settings.</p>

      <div className="gc-grid-dense gc-grid-dense-3 mb-10">
        <Link href="/intelligence" className="gc-card hover:bg-white/[0.06] transition-colors">
          <p className="gc-eyebrow mb-2">Intel</p>
          <p className="text-xl display">Intelligence</p>
          <p className="text-sm text-[var(--gc-muted)] mt-2">Summaries, risks, and operational insights.</p>
        </Link>
        <Link href="/credit-pulse" className="gc-card hover:bg-white/[0.06] transition-colors">
          <p className="gc-eyebrow mb-2">Credit</p>
          <p className="text-xl display">Friday Pulse</p>
          <p className="text-sm text-[var(--gc-muted)] mt-2">Weekly updates and score request management.</p>
        </Link>
        {hasPermission(user.role, "VIEW_FINANCE_DASHBOARD") && (
          <Link href="/pay" className="gc-card hover:bg-white/[0.06] transition-colors">
            <p className="gc-eyebrow mb-2">Finance</p>
            <p className="text-xl display">Grants Pay</p>
            <p className="text-sm text-[var(--gc-muted)] mt-2">Settlement and payout visibility.</p>
          </Link>
        )}
        <Link href="/dashboard" className="gc-card hover:bg-white/[0.06] transition-colors">
          <p className="gc-eyebrow mb-2">Legacy</p>
          <p className="text-xl display">Finance health</p>
          <p className="text-sm text-[var(--gc-muted)] mt-2">Classic financial snapshot view.</p>
        </Link>
      </div>

      <section id="systems" className="mb-10">
        <h2 className="text-2xl mb-4">System health</h2>
        <div className="gc-grid-dense gc-grid-dense-3">
          {integrations.map((i) => (
            <div key={i.id} className="gc-card">
              <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">
                {i.provider.replaceAll("_", " ")}
              </p>
              <p className="font-medium mb-1">
                {i.status === "MOCK" ? "Connected · development adapter" : i.status}
              </p>
              <p className="text-xs text-[var(--gc-muted)]">
                Last successful sync {i.lastSyncAt ? i.lastSyncAt.toLocaleString() : "pending"}
              </p>
            </div>
          ))}
          <div className="gc-card">
            <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">Payments</p>
            <p className="font-medium mb-1">Abstraction ready</p>
            <p className="text-xs text-[var(--gc-muted)]">Authorize.Net / Commas adapters · mock active in development</p>
          </div>
          <div className="gc-card">
            <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">Communication</p>
            <p className="font-medium mb-1">OS inbox live</p>
            <p className="text-xs text-[var(--gc-muted)]">Provider delivery channel configurable · GHL/SMS adapters later</p>
          </div>
        </div>
      </section>

      {(user.role === "OWNER" || user.role === "ADMIN") && (
        <section>
          <h2 className="text-2xl mb-4">Owner review</h2>
          <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
            {ownerReviews.length === 0 && (
              <p className="py-5 text-sm text-[var(--gc-muted)]">No items awaiting owner review.</p>
            )}
            {ownerReviews.map((c) => (
              <Link key={c.id} href={`/clients/${c.grantsClientId}`} className="py-4 flex justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="text-sm text-[var(--gc-muted)]">{c.nextAction}</p>
                </div>
                <span className="gc-status gc-status-warn">Owner</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
