import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessFinancialData, hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { getClientTimeline } from "@/lib/clients/timeline";
import { formatUsd } from "@/lib/payments/dashboard";
import { ClientActions } from "@/components/clients/ClientActions";
import { ClientHandoffActions } from "@/components/clients/ClientHandoffActions";
import { ScoreIntelligencePanel } from "@/components/credit/ScoreIntelligencePanel";
import { buildScoreIntelligence } from "@/lib/credit/score-intelligence";
import { Tabs } from "@/components/ui/Tabs";
import { Panel, ProgressSteps } from "@/components/ui/density";
import { LineChart } from "@/components/ui/charts";

export default async function Client360Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_CLIENT")) return <p>Access denied.</p>;

  const { id } = await params;
  const { tab: tabRaw } = await searchParams;
  const tab = tabRaw || "overview";

  const client = await prisma.client.findFirst({
    where: { OR: [{ grantsClientId: id }, { id }] },
    include: {
      identifiers: true,
      assignments: {
        include: { staff: { select: { firstName: true, lastName: true, role: true } } },
      },
      onboardingChecklist: { orderBy: { label: "asc" } },
      disputeRounds: { orderBy: { roundNumber: "desc" } },
      documents: { orderBy: { createdAt: "desc" }, take: 20 },
      tasks: {
        where: { status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] } },
        include: { assignee: { select: { firstName: true, lastName: true } } },
        orderBy: { dueAt: "asc" },
      },
      clientServices: {
        include: { service: true, billingPolicy: true, milestones: true },
      },
      creditScores: { orderBy: { capturedAt: "asc" } },
      creditConnections: {
        select: { provider: true, status: true, needsReauth: true, lastSyncedAt: true },
      },
      conversations: {
        where: { kind: { in: ["CLIENT", "CLIENT_INTERNAL"] } },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 12,
            include: { sender: { select: { firstName: true } } },
          },
        },
      },
    },
  });
  if (!client) notFound();

  const timeline = await getClientTimeline(client.id);
  const showFinance = canAccessFinancialData(user.role);
  const scoreIntel = buildScoreIntelligence(client.creditScores);
  const base = `/clients/${client.grantsClientId}`;

  const invoices = showFinance
    ? await prisma.invoice.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" } })
    : [];
  const transactions = showFinance
    ? await prisma.paymentTransaction.findMany({
        where: { clientId: client.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const clientConv = client.conversations.find((c) => c.kind === "CLIENT");
  const internalConv = client.conversations.find((c) => c.kind === "CLIENT_INTERNAL");
  const onboardingComplete = client.onboardingChecklist.filter((i) => i.status === "COMPLETE").length;
  const onboardingMissing = client.onboardingChecklist.filter((i) => i.status === "MISSING").length;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "credit", label: "Credit", count: scoreIntel.length },
    { id: "disputes", label: "Disputes", count: client.disputeRounds.length },
    { id: "documents", label: "Documents", count: client.documents.length },
    { id: "tasks", label: "Tasks", count: client.tasks.length },
    { id: "comms", label: "Comms" },
    { id: "timeline", label: "Timeline", count: timeline.length },
    ...(showFinance ? [{ id: "pay", label: "Pay", count: invoices.length }] : []),
  ];

  // Build multi-series score history for chart (same model groups only plotted separately)
  const chartSeries = scoreIntel.slice(0, 3).map((g, idx) => ({
    name: `${g.bureau} · ${g.source}`,
    color: ["#b2d4ff", "#f5b82a", "#67a671"][idx],
    values: g.history.map((h) => h.score),
  }));

  return (
    <div className="gc-fade-up space-y-4">
      {/* Header dossier */}
      <div className="gc-panel gc-panel-ice p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
          <div className="flex gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-[var(--gc-border)] flex items-center justify-center display text-xl shrink-0">
              {client.firstName[0]}
              {client.lastName[0]}
            </div>
            <div className="min-w-0">
              <p className="gc-eyebrow mb-1">{client.grantsClientId}</p>
              <h1 className="text-3xl md:text-4xl mb-2 truncate">
                {client.firstName} {client.lastName}
              </h1>
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="gc-status gc-status-ok">{client.status}</span>
                <span className="gc-status gc-status-ice">{client.stage.replaceAll("_", " ")}</span>
                <span
                  className={`gc-status ${
                    client.urgency === "HIGH" || client.urgency === "CRITICAL" ? "gc-status-danger" : ""
                  }`}
                >
                  {client.urgency}
                </span>
              </div>
              <p className="text-sm text-[var(--gc-muted)]">
                {client.email}
                {client.phone ? ` · ${client.phone}` : ""}
                {" · "}
                Assigned:{" "}
                {client.assignments.length
                  ? client.assignments.map((a) => a.staff.firstName).join(", ")
                  : "Unassigned"}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 min-w-[280px] xl:min-w-[360px]">
            <div className="gc-card">
              <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-ice)] mb-2">Next action</p>
              <p className="font-medium text-sm mb-1">{client.nextAction || "Define next action"}</p>
              <p className="text-xs text-[var(--gc-muted)]">
                {client.nextActionOwner || "—"}
                {client.nextDueAt ? ` · due ${client.nextDueAt.toLocaleDateString()}` : ""}
              </p>
            </div>
            <div className="gc-card">
              <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">Onboarding</p>
              <p className="display text-2xl mb-1">
                {onboardingComplete}
                <span className="text-base text-[var(--gc-muted)]">/{client.onboardingChecklist.length || 0}</span>
              </p>
              <p className="text-xs text-[var(--gc-muted)]">{onboardingMissing} missing</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {clientConv && (
            <Link href={`/inbox?tab=client&c=${clientConv.id}`} className="gc-btn gc-btn-gold">
              Message client
            </Link>
          )}
          {internalConv && (
            <Link href={`/inbox?tab=team&c=${internalConv.id}`} className="gc-btn gc-btn-ice">
              Internal thread
            </Link>
          )}
          <ClientHandoffActions
            clientId={client.id}
            stage={client.stage}
            canManage={hasPermission(user.role, "MANAGE_OPERATIONS")}
            role={user.role}
          />
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} baseHref={base} />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="gc-dash-grid gc-dash-grid-12">
            <Panel title="Client information" className="gc-span-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2"><span className="text-[var(--gc-muted)]">Email</span><span>{client.email}</span></div>
                <div className="flex justify-between gap-2"><span className="text-[var(--gc-muted)]">Phone</span><span>{client.phone || "—"}</span></div>
                <div className="flex justify-between gap-2"><span className="text-[var(--gc-muted)]">Stage</span><span>{client.stage.replaceAll("_", " ")}</span></div>
                {client.clientServices.map((cs) => (
                  <div key={cs.id} className="flex justify-between gap-2">
                    <span className="text-[var(--gc-muted)]">Service</span>
                    <span>{cs.service.name}</span>
                  </div>
                ))}
                {showFinance && invoices[0] && (
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--gc-muted)]">Payment</span>
                    <span className="gc-status">{invoices[0].status}</span>
                  </div>
                )}
              </div>
            </Panel>
            <Panel title="Onboarding progress" className="gc-span-8">
              <ProgressSteps
                steps={client.onboardingChecklist.map((i) => ({
                  label: i.label,
                  status: i.status === "COMPLETE" ? "COMPLETE" : i.status === "WAIVED" ? "WAIVED" : "MISSING",
                }))}
              />
              <div className="mt-4 grid sm:grid-cols-2 gap-2">
                {client.onboardingChecklist.map((item) => (
                  <div key={item.id} className="flex justify-between gap-2 text-sm py-1.5 border-b border-[var(--gc-border)]">
                    <span>{item.label}</span>
                    <span className={`gc-status ${item.status === "COMPLETE" ? "gc-status-ok" : "gc-status-warn"}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <ClientActions
            clientId={client.id}
            grantsClientId={client.grantsClientId}
            milestones={client.clientServices.flatMap((cs) =>
              cs.milestones.map((m) => ({
                id: m.id,
                name: m.name,
                isCompleted: m.isCompleted,
                invoiceEligible: m.invoiceEligible,
                invoiceCreated: m.invoiceCreated,
                serviceName: cs.service.name,
              })),
            )}
            canManage={hasPermission(user.role, "MANAGE_OPERATIONS")}
            canPay={hasPermission(user.role, "MANAGE_PAYMENTS")}
          />

          <div className="gc-dash-grid gc-dash-grid-12">
            <Panel title="Score snapshot" className="gc-span-7" action={<Link href={`${base}?tab=credit`} className="text-[0.65rem] uppercase tracking-wider text-[var(--gc-ice)]">Full intel</Link>}>
              <ScoreIntelligencePanel groups={scoreIntel.slice(0, 3)} />
            </Panel>
            <Panel title="Open tasks" className="gc-span-5" action={<Link href={`${base}?tab=tasks`} className="text-[0.65rem] uppercase tracking-wider text-[var(--gc-ice)]">All</Link>}>
              {client.tasks.length === 0 && <p className="text-sm text-[var(--gc-muted)]">No open tasks.</p>}
              {client.tasks.map((t) => (
                <div key={t.id} className="py-2.5 border-b border-[var(--gc-border)]">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-[var(--gc-muted)]">
                    {t.assignee ? `${t.assignee.firstName}` : "Unassigned"} · {t.priority}
                  </p>
                </div>
              ))}
            </Panel>
          </div>
        </div>
      )}

      {tab === "credit" && (
        <div className="space-y-4">
          <Panel title="Score Intelligence" eyebrow="Models never mixed">
            <ScoreIntelligencePanel groups={scoreIntel} />
          </Panel>
          {chartSeries.length > 0 && (
            <Panel title="Score history" eyebrow="Trend by bureau/source">
              <LineChart series={chartSeries} height={200} />
            </Panel>
          )}
          <div className="flex flex-wrap gap-2">
            {client.creditConnections.map((c) => (
              <span key={c.provider} className="gc-status">
                {c.provider}: {c.status}
                {c.needsReauth ? " · reconnect" : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {tab === "disputes" && (
        <Panel title="Dispute process" action={
          <a className="gc-btn gc-btn-outline text-xs" href="https://app.disputefox.com/" target="_blank" rel="noreferrer">
            Open dispute workspace
          </a>
        }>
          <div className="space-y-3">
            {client.disputeRounds.map((r) => (
              <div key={r.id} className="gc-card">
                <div className="flex justify-between gap-3 mb-2">
                  <p className="font-medium">Round {r.roundNumber}</p>
                  <span className="gc-status">{r.status.replaceAll("_", " ")}</span>
                </div>
                <p className="text-sm text-[var(--gc-muted)]">
                  Prepared {r.preparedAt?.toLocaleDateString() || "—"} · Sent {r.sentAt?.toLocaleDateString() || "—"} ·
                  Results {r.resultsReceivedAt?.toLocaleDateString() || "—"}
                </p>
                <div className="gc-dash-grid gc-dash-grid-4 mt-3">
                  <div><p className="text-[0.6rem] uppercase text-[var(--gc-muted)]">Negative</p><p className="display text-xl">{r.negativeItemsCount}</p></div>
                  <div><p className="text-[0.6rem] uppercase text-[var(--gc-muted)]">Deleted</p><p className="display text-xl">{r.deletedItemsCount}</p></div>
                  <div><p className="text-[0.6rem] uppercase text-[var(--gc-muted)]">Remaining</p><p className="display text-xl">{r.remainingItemsCount}</p></div>
                </div>
              </div>
            ))}
            {client.disputeRounds.length === 0 && (
              <p className="text-sm text-[var(--gc-muted)]">No dispute rounds tracked yet.</p>
            )}
          </div>
        </Panel>
      )}

      {tab === "documents" && (
        <Panel title="Document center">
          <table className="gc-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {client.documents.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td className="text-[var(--gc-muted)]">{d.category || "file"}</td>
                  <td className="text-[var(--gc-muted)]">{d.createdAt.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {client.documents.length === 0 && <p className="text-sm text-[var(--gc-muted)] py-4">No documents yet.</p>}
        </Panel>
      )}

      {tab === "tasks" && (
        <Panel title="Tasks">
          {client.tasks.map((t) => (
            <div key={t.id} className="gc-card mb-2">
              <div className="flex justify-between gap-3">
                <p className="font-medium">{t.title}</p>
                <span className="gc-status">{t.status}</span>
              </div>
              <p className="text-xs text-[var(--gc-muted)] mt-1">
                {t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "Unassigned"} · {t.priority}
                {t.dueAt ? ` · due ${t.dueAt.toLocaleDateString()}` : ""}
              </p>
            </div>
          ))}
          {client.tasks.length === 0 && <p className="text-sm text-[var(--gc-muted)]">No open tasks.</p>}
        </Panel>
      )}

      {tab === "comms" && (
        <div className="gc-dash-grid gc-dash-grid-2">
          <Panel title="Client channel" eyebrow="Leaves the company" action={clientConv && <Link href={`/inbox?tab=client&c=${clientConv.id}`} className="text-[0.65rem] uppercase tracking-wider text-[var(--gc-gold)]">Open inbox</Link>}>
            {(clientConv?.messages || []).map((m) => (
              <div key={m.id} className="gc-bubble-client mb-2">
                <p className="gc-bubble-label client">Client{m.sender ? ` · ${m.sender.firstName}` : ""}</p>
                <p className="text-sm">{m.body}</p>
              </div>
            ))}
            {!clientConv?.messages?.length && <p className="text-sm text-[var(--gc-muted)]">No client messages.</p>}
          </Panel>
          <Panel title="Internal thread" eyebrow="Staff only" action={internalConv && <Link href={`/inbox?tab=team&c=${internalConv.id}`} className="text-[0.65rem] uppercase tracking-wider text-[var(--gc-ice)]">Open</Link>}>
            {(internalConv?.messages || []).map((m) => (
              <div key={m.id} className="gc-bubble-internal mb-2">
                <p className="gc-bubble-label internal">Internal{m.sender ? ` · ${m.sender.firstName}` : ""}</p>
                <p className="text-sm">{m.body}</p>
              </div>
            ))}
            {!internalConv?.messages?.length && <p className="text-sm text-[var(--gc-muted)]">No internal notes.</p>}
          </Panel>
        </div>
      )}

      {tab === "timeline" && (
        <Panel title="Journey timeline">
          <div className="space-y-4">
            {timeline.map((e) => (
              <div key={e.id} className="border-l border-[var(--gc-ice)] pl-4">
                <p className="font-medium">{e.title}</p>
                {e.description && <p className="text-sm text-[var(--gc-muted)]">{e.description}</p>}
                <p className="text-[0.65rem] tracking-[0.12em] uppercase text-[var(--gc-muted)] mt-1">
                  {e.eventType} · {e.createdAt.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === "pay" && showFinance && (
        <div className="space-y-4">
          <Panel title="Invoices">
            <table className="gc-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.invoiceNumber}</td>
                    <td><span className="gc-status">{inv.status}</span></td>
                    <td className="display">{formatUsd(inv.amountCents)}</td>
                    <td>
                      {(inv.status === "DUE" || inv.status === "FAILED") && (
                        <Link href={`/pay/${inv.invoiceNumber}`} className="text-[0.65rem] uppercase tracking-wider text-[var(--gc-gold)]">
                          Collect
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel title="Payment timeline">
            <table className="gc-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Settlement</th>
                  <th>Payout</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.status}</td>
                    <td>{t.settlementStatus}</td>
                    <td>{t.payoutStatus}</td>
                    <td>{formatUsd(t.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      )}
    </div>
  );
}
