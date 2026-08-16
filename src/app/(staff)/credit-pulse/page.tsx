import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { FridayPulseButton } from "@/components/credit/FridayPulseButton";
import { ScoreIntelligencePanel } from "@/components/credit/ScoreIntelligencePanel";
import { buildScoreIntelligence } from "@/lib/credit/score-intelligence";
import { getGcEnvironment } from "@/lib/integrations/env";
import { integrationCredentialStatus } from "@/lib/integrations/credentials";

export default async function CreditPulsePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "MANAGE_CREDIT") && !hasPermission(user.role, "VIEW_CREDIT_DOCS")) {
    return <p>Access denied.</p>;
  }

  const canRunPulse = hasPermission(user.role, "MANAGE_CREDIT");

  const clients = await prisma.client.findMany({
    where: { creditScores: { some: {} } },
    include: {
      creditScores: { orderBy: { capturedAt: "asc" } },
      creditConnections: {
        select: { provider: true, status: true, needsReauth: true, lastSyncedAt: true },
      },
    },
    take: 50,
  });

  const pulseRuns = await prisma.fridayPulseRun.findMany({
    orderBy: { weekOf: "desc" },
    take: 3,
    include: {
      items: {
        include: {
          client: { select: { grantsClientId: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  const latest = pulseRuns[0];
  const pulseStats = latest
    ? {
        sent: latest.items.filter((i) => i.updateStatus === "SENT").length,
        pending: latest.items.filter((i) => i.updateStatus === "PENDING").length,
        failed: latest.items.filter((i) => i.updateStatus === "FAILED").length,
        scoreMissing: latest.items.filter((i) => i.scoreResponseStatus === "MISSING").length,
        review: latest.items.filter((i) => i.reviewRequired).length,
      }
    : null;

  const dataPlane = getGcEnvironment();
  const creds = integrationCredentialStatus();
  const creditLive = creds.smartCreditSponsor; // sponsor link present ≠ live score sync
  const creditLabel =
    dataPlane === "development"
      ? "Development sample scores · live bureau sync Awaiting Integration"
      : creditLive
        ? "Sponsor ready · score sync per client"
        : "Awaiting Integration";

  return (
    <div className="gc-fade-up">
      <div className="mb-10">
        <p className="gc-eyebrow mb-2">Grants Credit Pulse</p>
        <h1 className="text-4xl md:text-5xl mb-2">Score Intelligence</h1>
        <p className="text-sm text-[var(--gc-muted)] max-w-2xl leading-relaxed">
          Baseline → previous → current, with source and scoring model preserved. Different models are never treated as interchangeable.
          {" · "}
          {creditLabel}
        </p>
      </div>

      {pulseStats && (
        <section className="mb-10">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl">Friday Pulse management</h2>
              <p className="text-sm text-[var(--gc-muted)]">
                Week of {latest!.weekOf.toLocaleDateString()} · {latest!.status}
              </p>
            </div>
          </div>
          <div className="gc-grid-dense gc-grid-dense-4 mb-4">
            <div className="gc-card">
              <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">Updates sent</p>
              <p className="display text-3xl">{pulseStats.sent}</p>
            </div>
            <div className="gc-card">
              <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">Pending</p>
              <p className="display text-3xl">{pulseStats.pending}</p>
            </div>
            <div className="gc-card">
              <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">Score missing</p>
              <p className="display text-3xl">{pulseStats.scoreMissing}</p>
            </div>
            <div className="gc-card">
              <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">Simon review</p>
              <p className="display text-3xl">{pulseStats.review}</p>
            </div>
          </div>
          <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
            {latest!.items.map((item) => (
              <Link
                key={item.id}
                href={`/clients/${item.client.grantsClientId}`}
                className="py-3 flex flex-col sm:flex-row sm:justify-between gap-2"
              >
                <div>
                  <p className="font-medium">
                    {item.client.firstName} {item.client.lastName}
                  </p>
                  <p className="text-sm text-[var(--gc-muted)]">{item.statusUpdate}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="gc-status">{item.updateStatus}</span>
                  <span className="gc-status gc-status-ice">Score {item.scoreResponseStatus}</span>
                  {item.reviewRequired && <span className="gc-status gc-status-warn">Review</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-10">
        {clients.map((c) => {
          const groups = buildScoreIntelligence(c.creditScores);
          return (
            <section key={c.id} className="border-b border-[var(--gc-border)] pb-8">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-2xl">
                    <Link href={`/clients/${c.grantsClientId}`}>
                      {c.firstName} {c.lastName}
                    </Link>
                  </h2>
                  <p className="text-xs text-[var(--gc-muted)]">{c.grantsClientId}</p>
                </div>
                {canRunPulse && <FridayPulseButton clientId={c.id} />}
              </div>
              <ScoreIntelligencePanel groups={groups} />
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--gc-muted)]">
                {c.creditConnections.map((conn) => (
                  <span key={conn.provider} className="gc-status">
                    {conn.provider}: {conn.status}
                    {conn.needsReauth ? " · reconnect" : ""}
                  </span>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
