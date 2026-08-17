import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { GhlSyncPanel } from "@/components/integrations/GhlSyncPanel";
import { GhlConversationPullPanel } from "@/components/integrations/GhlConversationPullPanel";
import { getGcEnvironment } from "@/lib/integrations/env";
import { isGhlApiReady } from "@/lib/integrations/ghl/http";
import { integrationCredentialStatus } from "@/lib/integrations/credentials";

export default async function MorePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const integrations = await prisma.integrationConnection.findMany({ orderBy: { provider: "asc" } });
  const ownerReviews = await prisma.client.findMany({
    where: { nextActionOwner: "CHARLES" },
    take: 10,
    orderBy: { updatedAt: "desc" },
  });
  const creds = integrationCredentialStatus();
  const dataPlane = getGcEnvironment();
  const ghlReady = isGhlApiReady();

  function statusLabel(provider: string, status: string) {
    if (provider === "gohighlevel") {
      if (ghlReady) return status === "CONNECTED" ? "Connected · live API" : "Ready · awaiting first sync";
      return "Awaiting Integration";
    }
    if (provider === "disputefox") {
      return creds.disputeFoxApi ? status : "Awaiting Integration";
    }
    if (status === "MOCK") return "Connected · development adapter";
    if (status === "AWAITING_CREDENTIALS") return "Awaiting Integration";
    return status;
  }

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">Tools & oversight</p>
      <h1 className="text-4xl mb-2">More</h1>
      <p className="gc-section-sub">
        Intelligence, system health, owner review, and settings · {dataPlane} data plane
      </p>

      <div className="gc-grid-dense gc-grid-dense-3 mb-10">
        <Link href="/agents" className="gc-card hover:bg-white/[0.06] transition-colors">
          <p className="gc-eyebrow mb-2">Workforce</p>
          <p className="text-xl display">Agent Hub</p>
          <p className="text-sm text-[var(--gc-muted)] mt-2">
            X1, Payment, Cursor — approvals only when Level 3.
          </p>
        </Link>
        <Link href="/intelligence" className="gc-card hover:bg-white/[0.06] transition-colors">
          <p className="gc-eyebrow mb-2">Intel</p>
          <p className="text-xl display">Intelligence</p>
          <p className="text-sm text-[var(--gc-muted)] mt-2">Summaries, risks, and operational insights.</p>
        </Link>
        {hasPermission(user.role, "VIEW_MARKETING") && (
          <Link href="/acquisition" className="gc-card hover:bg-white/[0.06] transition-colors">
            <p className="gc-eyebrow mb-2">Growth</p>
            <p className="text-xl display">Acquisition</p>
            <p className="text-sm text-[var(--gc-muted)] mt-2">
              Partner vs consumer engines — scaffolding, no live outreach.
            </p>
          </Link>
        )}
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
        <Link href="/system-health" className="gc-card hover:bg-white/[0.06] transition-colors">
          <p className="gc-eyebrow mb-2">Ops</p>
          <p className="text-xl display">System Health</p>
          <p className="text-sm text-[var(--gc-muted)] mt-2">
            Commas, GHL, DisputeFox, queues, webhooks, backups.
          </p>
        </Link>
        <Link href="/automations" className="gc-card hover:bg-white/[0.06] transition-colors">
          <p className="gc-eyebrow mb-2">Lifecycle</p>
          <p className="text-xl display">Automations</p>
          <p className="text-sm text-[var(--gc-muted)] mt-2">
            Payment → intake → staffing · exceptions only when needed.
          </p>
        </Link>
        <Link href="/dashboard" className="gc-card hover:bg-white/[0.06] transition-colors">
          <p className="gc-eyebrow mb-2">Legacy</p>
          <p className="text-xl display">Finance health</p>
          <p className="text-sm text-[var(--gc-muted)] mt-2">Classic financial snapshot view.</p>
        </Link>
      </div>

      <section id="systems" className="mb-10">
        <h2 className="text-2xl mb-4">System health</h2>
        {hasPermission(user.role, "MANAGE_OPERATIONS") && (
          <div className="mb-6 space-y-4">
            <GhlSyncPanel canSync />
            <GhlConversationPullPanel canSync />
          </div>
        )}
        <div className="gc-grid-dense gc-grid-dense-3">
          {integrations.map((i) => (
            <div key={i.id} className="gc-card">
              <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">
                {i.provider.replaceAll("_", " ")}
              </p>
              <p className="font-medium mb-1">{statusLabel(i.provider, i.status)}</p>
              <p className="text-xs text-[var(--gc-muted)]">
                Last successful sync {i.lastSyncAt ? i.lastSyncAt.toLocaleString() : "pending"}
              </p>
            </div>
          ))}
          <div className="gc-card">
            <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">Payments</p>
            <p className="font-medium mb-1">Commas primary · mock local</p>
            <p className="text-xs text-[var(--gc-muted)]">
              Hosted payment_link · webhooks · live charges locked
            </p>
          </div>
          <div className="gc-card">
            <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">Communication</p>
            <p className="font-medium mb-1">OS inbox live</p>
            <p className="text-xs text-[var(--gc-muted)]">
              GHL message sync · {ghlReady ? "API ready (no live sends)" : "Awaiting Integration"}
            </p>
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
