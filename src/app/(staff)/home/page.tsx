import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { formatUsd } from "@/lib/payments/dashboard";
import {
  clientSourceLabel,
  getJonaProcessingBoard,
  getOwnerCommandCenter,
  getSimonCareBoard,
} from "@/lib/ops/command-center";
import { roleHomeLabel, type StaffRole } from "@/lib/nav/role-nav";
import { prisma } from "@/lib/db/prisma";
import { MetricTile, Panel, StatRow } from "@/components/ui/density";
import { DonutChart, LineChart } from "@/components/ui/charts";
import { GhlSyncPanel } from "@/components/integrations/GhlSyncPanel";
import { GhlConversationPullPanel } from "@/components/integrations/GhlConversationPullPanel";
import { hasPermission } from "@/lib/rbac/permissions";

const STAGE_COLORS = ["#b2d4ff", "#f5b82a", "#67a671", "#6887d6", "#fdd79a", "#ff6b6b", "#94a1b2", "#ffffff"];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role === Role.OWNER || user.role === Role.ADMIN) {
    const data = await getOwnerCommandCenter();
    const sparkCollect = data.revenueTrend.values.map((v) => Math.max(v, 0));
    const monthLabel = formatUsd(data.finance.collectedMonthCents);

    return (
      <div className="gc-fade-up space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-3 mb-1">
          <div>
            <p className="gc-eyebrow mb-1">Owner command</p>
            <h1 className="text-3xl md:text-[2.35rem] mb-1 leading-none">{roleHomeLabel(user.role as StaffRole)}</h1>
            <p className="text-[var(--gc-muted)] text-sm">
              {data.integrationHealth.dataPlane} data plane · money · team · exceptions · systems
              {" · "}
              GHL{" "}
              {data.integrationHealth.ghlReady
                ? `${data.ops.ghlLiveLinked} live linked`
                : "Awaiting Integration"}
            </p>
          </div>
          <div className="hidden xl:flex flex-wrap gap-2">
            <Link href="/pay" className="gc-btn gc-btn-primary text-xs">
              Grants Pay
            </Link>
            <Link href="/work" className="gc-btn gc-btn-outline text-xs">
              Work board
            </Link>
            <Link href="/team-chat" className="gc-btn gc-btn-ice text-xs">
              Team chat
            </Link>
          </div>
        </div>

        {/* KPI strip — always 4 across on desktop */}
        <div className="gc-dash-grid gc-dash-grid-4">
          <MetricTile
            label="Collected today"
            value={formatUsd(data.finance.collectedTodayCents)}
            href="/pay"
            spark={sparkCollect.slice(-7)}
            trend="↑ activity"
            tone="ice"
          />
          <MetricTile
            label="Collected this week"
            value={formatUsd(data.finance.collectedWeekCents)}
            href="/pay"
            spark={sparkCollect}
            tone="ok"
          />
          <MetricTile
            label="Active clients"
            value={data.ops.activeClients}
            href="/clients"
            hint={`${data.ops.newClients} new this week`}
            tone="ice"
          />
          <MetricTile
            label="Outstanding"
            value={formatUsd(data.finance.outstandingCents)}
            href="/pay?filter=failed"
            trend={data.finance.failedPaymentsCents ? `Failed ${formatUsd(data.finance.failedPaymentsCents)}` : "Clear"}
            tone={data.finance.failedPaymentsCents ? "danger" : "default"}
          />
        </div>

        {/* Multi-panel row */}
        <div className="gc-dash-grid gc-dash-grid-12">
          <Panel title="Operational overview" eyebrow="Clients" className="gc-span-5" action={<Link href="/work" className="text-[0.65rem] uppercase tracking-wider text-[var(--gc-ice)]">Open</Link>}>
            <div className="flex flex-col sm:flex-row gap-5 items-center">
              <DonutChart
                size={132}
                centerLabel={String(data.ops.activeClients)}
                centerSub="Active"
                segments={
                  data.stageBreakdown.length
                    ? data.stageBreakdown.map((s, i) => ({
                        value: s.count,
                        color: STAGE_COLORS[i % STAGE_COLORS.length],
                        label: s.stage,
                      }))
                    : [{ value: 1, color: "#2e3e68" }]
                }
              />
              <div className="flex-1 w-full">
                <StatRow label="New enrollments" value={data.ops.newClients} href="/clients" />
                <StatRow label="Waiting on client" value={data.ops.waitingOnClient} href="/work?view=simon" tone="warn" />
                <StatRow label="Ready for Simon" value={data.ops.readyForSimon} href="/work?view=simon" />
                <StatRow label="Ready for Jona" value={data.ops.readyForJona} href="/work?view=jona" />
                <StatRow label="Needs attention" value={data.ops.stuckClients} href="/work?view=attention" tone="danger" />
              </div>
            </div>
          </Panel>

          <Panel
            title="Revenue trend"
            eyebrow="Grants Pay · 14 days"
            className="gc-span-7"
            action={<span className="display text-xl text-[var(--gc-ice)]">{monthLabel}</span>}
          >
            <p className="text-xs text-[var(--gc-muted)] mb-3">Month collected (succeeded charges — not bank deposits)</p>
            <LineChart
              series={[{ name: "Collected", color: "#b2d4ff", values: data.revenueTrend.values }]}
              labels={data.revenueTrend.labels}
            />
            <div className="gc-dash-grid gc-dash-grid-4 mt-4">
              <MetricTile label="Pending settlement" value={formatUsd(data.finance.pendingSettlementCents)} />
              <MetricTile label="Refunds (month)" value={formatUsd(data.finance.refundsMonthCents)} />
              <MetricTile label="Chargebacks open" value={formatUsd(data.finance.chargebacksOpenCents)} tone="danger" />
              <MetricTile label="Payouts paid" value={formatUsd(data.finance.payoutsPaidCents)} tone="ok" />
            </div>
          </Panel>
        </div>

        <div className="gc-dash-grid gc-dash-grid-12">
          <Panel title="Team workload" eyebrow="Staff" className="gc-span-4" action={<Link href="/work" className="text-[0.65rem] uppercase tracking-wider text-[var(--gc-ice)]">Board</Link>}>
            <div className="space-y-3">
              <div className="gc-card">
                <div className="flex justify-between gap-2 mb-2">
                  <p className="font-medium">Simon Young</p>
                  <span className="gc-status gc-status-ice">Client Care</span>
                </div>
                <div className="flex justify-between text-sm text-[var(--gc-muted)]">
                  <span>Open {data.team.simonOpen}</span>
                  <span>Due today {data.team.simonDueToday}</span>
                </div>
              </div>
              <div className="gc-card">
                <div className="flex justify-between gap-2 mb-2">
                  <p className="font-medium">Jona</p>
                  <span className="gc-status gc-status-ice">Processing</span>
                </div>
                <div className="flex justify-between text-sm text-[var(--gc-muted)]">
                  <span>Open {data.team.jonaOpen}</span>
                  <span>Due today {data.team.jonaDueToday}</span>
                </div>
              </div>
              <StatRow label="Overdue tasks" value={data.team.overdueTasks} href="/work?view=overdue" tone="danger" />
              <StatRow label="Completed today" value={data.team.completedToday} tone="ok" />
            </div>
          </Panel>

          <Panel title="Needs attention" eyebrow="Exceptions" className="gc-span-5">
            <div className="divide-y divide-[var(--gc-border)] max-h-[280px] overflow-y-auto">
              {data.attention.length === 0 && (
                <p className="py-4 text-sm text-[var(--gc-muted)]">No urgent exceptions.</p>
              )}
              {data.attention.map((c) => (
                <Link key={c.id} href={`/clients/${c.grantsClientId}`} className="py-3 flex justify-between gap-3 block">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-xs text-[var(--gc-muted)] truncate">
                      {c.grantsClientId} · {clientSourceLabel(c.identifiers)} · {c.nextAction || "Review"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="gc-status gc-status-ice">{c.stage.replaceAll("_", " ")}</span>
                    <p className="text-[0.6rem] uppercase tracking-wider text-[var(--gc-muted)] mt-1">
                      {c.nextActionOwner}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="System status" eyebrow="Integrations" className="gc-span-3" action={<Link href="/more#systems" className="text-[0.65rem] uppercase tracking-wider text-[var(--gc-ice)]">All</Link>}>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-sm">GoHighLevel</span>
                <span className={`gc-status ${data.integrationHealth.ghlReady ? "gc-status-ok" : "gc-status-warn"}`}>
                  {data.integrationHealth.ghlReady ? "API ready" : "Awaiting Integration"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-sm">DisputeFox</span>
                <span className={`gc-status ${data.integrationHealth.disputeFoxReady ? "gc-status-ok" : "gc-status-warn"}`}>
                  {data.integrationHealth.disputeFoxReady ? "API ready" : "Awaiting Integration"}
                </span>
              </div>
              {data.integrations
                .filter((i) => !["gohighlevel", "disputefox"].includes(i.provider))
                .slice(0, 4)
                .map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-sm capitalize">{i.provider.replaceAll("_", " ")}</span>
                    <span className="gc-status">
                      {i.status === "MOCK" || i.status === "AWAITING_CREDENTIALS"
                        ? "Awaiting Integration"
                        : i.status}
                    </span>
                  </div>
                ))}
              <StatRow label="Pulse pending" value={data.communication.pulsePending} href="/credit-pulse" />
              <StatRow label="Client msgs (7d)" value={data.communication.unreadClientMessages} href="/inbox" />
            </div>
          </Panel>
        </div>

        {hasPermission(user.role, "MANAGE_OPERATIONS") && (
          <div className="space-y-4">
            <GhlSyncPanel canSync />
            <GhlConversationPullPanel canSync />
          </div>
        )}

        {data.recentScores.length > 0 && (
          <Panel title="Recent score movement" eyebrow="Credit intelligence" action={<Link href="/credit-pulse" className="text-[0.65rem] uppercase tracking-wider text-[var(--gc-ice)]">Open</Link>}>
            <div className="gc-dash-grid gc-dash-grid-2">
              {data.recentScores.map((s) => (
                <div key={s.id} className="gc-card flex justify-between gap-3">
                  <div>
                    <p className="text-xs text-[var(--gc-muted)] uppercase tracking-wider">{s.bureau}</p>
                    <p className="text-sm">{s.source} · {s.scoringModel}</p>
                  </div>
                  <p className={`display text-2xl ${s.changeAmount >= 0 ? "text-[var(--gc-success)]" : "text-[var(--gc-danger)]"}`}>
                    {s.changeAmount >= 0 ? "+" : ""}
                    {s.changeAmount}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    );
  }

  if (user.role === Role.CUSTOMER_SERVICE) {
    const board = await getSimonCareBoard(user.id);
    return (
      <div className="gc-fade-up space-y-4">
        <div>
          <p className="gc-eyebrow mb-2">Simon workspace</p>
          <h1 className="text-3xl md:text-4xl mb-1">Client Care</h1>
          <p className="text-sm text-[var(--gc-muted)] mb-4">Follow-ups, documents, results, handoffs to Jona.</p>
        </div>
        <div className="gc-dash-grid gc-dash-grid-4">
          <MetricTile label="Needs follow-up" value={board.buckets.needsFollowUp.length} href="/work" tone="warn" />
          <MetricTile label="Results to deliver" value={board.buckets.resultsToDeliver.length} href="/work" />
          <MetricTile label="Ready for Jona" value={board.buckets.readyForJona.length} href="/work" tone="ice" />
          <MetricTile label="Overdue" value={board.buckets.overdue.length} href="/work" tone="danger" />
        </div>
        <Panel title="Clients needing you" eyebrow="Queue">
          <div className="divide-y divide-[var(--gc-border)]">
            {board.clients.slice(0, 12).map((c) => (
              <Link key={c.id} href={`/clients/${c.grantsClientId}`} className="py-3 flex justify-between gap-3 block">
                <div>
                  <p className="font-medium">
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="text-sm text-[var(--gc-muted)]">
                    {c.grantsClientId} · {clientSourceLabel(c.identifiers)} · {c.nextAction || "Open Client 360"}
                  </p>
                </div>
                <span className="gc-status gc-status-ice">{c.stage.replaceAll("_", " ")}</span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  if (user.role === Role.FILE_PREPARER) {
    const board = await getJonaProcessingBoard(user.id);
    return (
      <div className="gc-fade-up space-y-4">
        <div>
          <p className="gc-eyebrow mb-2">Jona workspace</p>
          <h1 className="text-3xl md:text-4xl mb-1">File Processing</h1>
          <p className="text-sm text-[var(--gc-muted)] mb-4">Rounds, filings, results, returns to Client Care.</p>
        </div>
        <div className="gc-dash-grid gc-dash-grid-4">
          <MetricTile label="Ready" value={board.queues.readyForProcessing.length} tone="ice" />
          <MetricTile label="In review" value={board.queues.fileReview.length} />
          <MetricTile label="Waiting results" value={board.queues.waitingResults.length} />
          <MetricTile label="Return to Simon" value={board.queues.returnToSimon.length} tone="warn" />
        </div>
        <Panel title="Work items" eyebrow="Queue">
          <div className="divide-y divide-[var(--gc-border)]">
            {board.clients.slice(0, 12).map((c) => (
              <Link key={c.id} href={`/clients/${c.grantsClientId}`} className="py-3 flex justify-between gap-3 block">
                <div>
                  <p className="font-medium">
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="text-sm text-[var(--gc-muted)]">
                    {c.grantsClientId} · {clientSourceLabel(c.identifiers)} · {c.nextAction || "Open dossier"}
                    {c.disputeRounds[0] ? ` · Round ${c.disputeRounds[0].roundNumber}` : ""}
                  </p>
                </div>
                <span className="gc-status gc-status-ice">{c.stage.replaceAll("_", " ")}</span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  const openTasks = await prisma.task.count({
    where: { assigneeId: user.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">Workspace</p>
      <h1 className="text-3xl mb-4">{roleHomeLabel(user.role as StaffRole)}</h1>
      <MetricTile label="Open tasks" value={openTasks} href="/work" />
    </div>
  );
}
