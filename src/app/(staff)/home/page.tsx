import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { formatUsd } from "@/lib/payments/dashboard";
import {
  getJonaProcessingBoard,
  getOwnerCommandCenter,
  getSimonCareBoard,
} from "@/lib/ops/command-center";
import { roleHomeLabel, type StaffRole } from "@/lib/nav/role-nav";
import { prisma } from "@/lib/db/prisma";

function Metric({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const inner = (
    <div className="gc-card h-full">
      <p className="text-[0.62rem] tracking-[0.18em] uppercase text-[var(--gc-muted)] mb-2">{label}</p>
      <p className="display text-2xl md:text-3xl leading-none">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <p className="gc-eyebrow mb-2">{eyebrow}</p>
      <h2 className="gc-section-title">{title}</h2>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role === Role.OWNER || user.role === Role.ADMIN) {
    const data = await getOwnerCommandCenter();
    return (
      <div className="gc-fade-up">
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="gc-eyebrow mb-2">Grants &amp; Co OS</p>
            <h1 className="text-4xl md:text-5xl mb-2">{roleHomeLabel(user.role as StaffRole)}</h1>
            <p className="text-[var(--gc-muted)] text-sm max-w-2xl leading-relaxed">
              What happened. What needs you. How money moved. What the team is doing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/pay" className="gc-btn gc-btn-primary">
              Grants Pay
            </Link>
            <Link href="/inbox" className="gc-btn gc-btn-outline">
              Inbox
            </Link>
            <Link href="/more#systems" className="gc-btn gc-btn-ice">
              System Health
            </Link>
          </div>
        </div>

        <Section eyebrow="Grants Pay" title="Financial snapshot">
          <div className="gc-grid-dense gc-grid-dense-4">
            <Metric label="Collected today" value={formatUsd(data.finance.collectedTodayCents)} href="/pay" />
            <Metric label="Collected week" value={formatUsd(data.finance.collectedWeekCents)} href="/pay" />
            <Metric label="Collected month" value={formatUsd(data.finance.collectedMonthCents)} href="/pay" />
            <Metric label="Outstanding" value={formatUsd(data.finance.outstandingCents)} href="/pay" />
            <Metric label="Failed" value={formatUsd(data.finance.failedPaymentsCents)} href="/pay?filter=failed" />
            <Metric label="Pending settlement" value={formatUsd(data.finance.pendingSettlementCents)} href="/pay" />
            <Metric label="Refunds (month)" value={formatUsd(data.finance.refundsMonthCents)} href="/pay" />
            <Metric label="Chargebacks open" value={formatUsd(data.finance.chargebacksOpenCents)} href="/pay" />
            <Metric label="Net processed" value={formatUsd(data.finance.netProcessedCents)} href="/pay" />
            <Metric label="Payouts paid" value={formatUsd(data.finance.payoutsPaidCents)} href="/pay" />
          </div>
        </Section>

        <Section eyebrow="Operations" title="Client operations">
          <div className="gc-grid-dense gc-grid-dense-4">
            <Metric label="Active clients" value={data.ops.activeClients} href="/clients" />
            <Metric label="New this week" value={data.ops.newClients} href="/clients" />
            <Metric label="Waiting on client" value={data.ops.waitingOnClient} href="/work" />
            <Metric label="Ready for Simon" value={data.ops.readyForSimon} href="/work?view=simon" />
            <Metric label="Ready for Jona" value={data.ops.readyForJona} href="/work?view=jona" />
            <Metric label="Needs attention" value={data.ops.stuckClients} href="/work?view=attention" />
          </div>
        </Section>

        <div className="grid lg:grid-cols-2 gap-8 mb-10">
          <Section eyebrow="Team" title="Workload">
            <div className="gc-grid-dense">
              <Metric label="Simon open work" value={data.team.simonOpen} href="/work?view=simon" />
              <Metric label="Jona open work" value={data.team.jonaOpen} href="/work?view=jona" />
              <Metric label="Overdue tasks" value={data.team.overdueTasks} href="/work?view=overdue" />
              <Metric label="Completed today" value={data.team.completedToday} href="/work" />
            </div>
          </Section>
          <Section eyebrow="Communication" title="Inbox & Pulse">
            <div className="gc-grid-dense">
              <Metric label="Client messages (7d)" value={data.communication.unreadClientMessages} href="/inbox" />
              <Metric label="Team messages (7d)" value={data.communication.internalUnread} href="/inbox?tab=team" />
              <Metric label="Friday updates pending" value={data.communication.pulsePending} href="/credit-pulse" />
              <Metric label="Friday updates failed" value={data.communication.pulseFailed} href="/credit-pulse" />
            </div>
          </Section>
        </div>

        <Section eyebrow="Exceptions" title="Needs your attention">
          <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
            {data.attention.length === 0 && (
              <p className="py-6 text-sm text-[var(--gc-muted)]">No urgent exceptions right now.</p>
            )}
            {data.attention.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.grantsClientId}`}
                className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-white/[0.02]"
              >
                <div>
                  <p className="font-medium">
                    {c.firstName} {c.lastName}{" "}
                    <span className="text-[var(--gc-muted)] text-xs tracking-wider">{c.grantsClientId}</span>
                  </p>
                  <p className="text-sm text-[var(--gc-muted)]">{c.nextAction || "Review client status"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="gc-status gc-status-ice">{c.stage.replaceAll("_", " ")}</span>
                  <span className={`gc-status ${c.urgency === "CRITICAL" || c.urgency === "HIGH" ? "gc-status-danger" : ""}`}>
                    {c.nextActionOwner || "—"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Section>

        <Section eyebrow="Systems" title="Integration health">
          <div className="gc-grid-dense gc-grid-dense-3">
            {data.integrations.map((i) => (
              <div key={i.id} className="gc-card">
                <p className="text-[0.62rem] tracking-[0.16em] uppercase text-[var(--gc-muted)] mb-2">
                  {i.provider.replaceAll("_", " ")}
                </p>
                <p className="font-medium mb-1">{i.status === "MOCK" ? "Connected (dev)" : i.status}</p>
                <p className="text-xs text-[var(--gc-muted)]">
                  Last sync {i.lastSyncAt ? i.lastSyncAt.toLocaleString() : "not yet"}
                </p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  if (user.role === Role.CUSTOMER_SERVICE) {
    const board = await getSimonCareBoard(user.id);
    return (
      <div className="gc-fade-up">
        <p className="gc-eyebrow mb-2">Simon workspace</p>
        <h1 className="text-4xl md:text-5xl mb-2">Client Care</h1>
        <p className="text-[var(--gc-muted)] text-sm mb-8 max-w-xl">
          Follow-ups, documents, results delivery, and handoffs to Jona — without leaving Grants &amp; Co OS.
        </p>
        <div className="gc-grid-dense gc-grid-dense-3 mb-8">
          <Metric label="Needs follow-up" value={board.buckets.needsFollowUp.length} href="/work" />
          <Metric label="Results to deliver" value={board.buckets.resultsToDeliver.length} href="/work" />
          <Metric label="Ready for Jona" value={board.buckets.readyForJona.length} href="/work" />
          <Metric label="Due today" value={board.buckets.dueToday.length} href="/work" />
          <Metric label="Overdue" value={board.buckets.overdue.length} href="/work" />
        </div>
        <Section eyebrow="Queue" title="Clients needing you">
          <div className="divide-y divide-[var(--gc-border)]">
            {board.clients.slice(0, 12).map((c) => (
              <Link key={c.id} href={`/clients/${c.grantsClientId}`} className="py-4 block">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-sm text-[var(--gc-muted)]">{c.nextAction || "Open Client 360"}</p>
                  </div>
                  <span className="gc-status gc-status-ice">{c.stage.replaceAll("_", " ")}</span>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  if (user.role === Role.FILE_PREPARER) {
    const board = await getJonaProcessingBoard(user.id);
    return (
      <div className="gc-fade-up">
        <p className="gc-eyebrow mb-2">Jona workspace</p>
        <h1 className="text-4xl md:text-5xl mb-2">File Processing</h1>
        <p className="text-[var(--gc-muted)] text-sm mb-8 max-w-xl">
          Ready files, rounds, filings, and results — tracked in Grants &amp; Co OS with contextual workspace launches.
        </p>
        <div className="gc-grid-dense gc-grid-dense-3 mb-8">
          <Metric label="Ready for processing" value={board.queues.readyForProcessing.length} />
          <Metric label="File review" value={board.queues.fileReview.length} />
          <Metric label="Submitted" value={board.queues.submitted.length} />
          <Metric label="Waiting results" value={board.queues.waitingResults.length} />
          <Metric label="Results received" value={board.queues.resultsReceived.length} />
          <Metric label="Return to Simon" value={board.queues.returnToSimon.length} />
        </div>
        <Section eyebrow="Queue" title="Your work items">
          <div className="divide-y divide-[var(--gc-border)]">
            {board.clients.slice(0, 12).map((c) => (
              <Link key={c.id} href={`/clients/${c.grantsClientId}`} className="py-4 block">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-sm text-[var(--gc-muted)]">
                      {c.nextAction || "Open processing dossier"}
                      {c.disputeRounds[0] ? ` · Round ${c.disputeRounds[0].roundNumber}` : ""}
                    </p>
                  </div>
                  <span className="gc-status gc-status-ice">{c.stage.replaceAll("_", " ")}</span>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  const openTasks = await prisma.task.count({
    where: { assigneeId: user.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">Workspace</p>
      <h1 className="text-4xl mb-4">{roleHomeLabel(user.role as StaffRole)}</h1>
      <Metric label="Open tasks" value={openTasks} href="/work" />
    </div>
  );
}
