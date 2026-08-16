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

export default async function Client360Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_CLIENT")) return <p>Access denied.</p>;

  const { id } = await params;
  const client = await prisma.client.findFirst({
    where: { OR: [{ grantsClientId: id }, { id }] },
    include: {
      identifiers: true,
      assignments: {
        include: { staff: { select: { firstName: true, lastName: true, role: true } } },
      },
      onboardingChecklist: { orderBy: { label: "asc" } },
      disputeRounds: { orderBy: { roundNumber: "desc" } },
      documents: { orderBy: { createdAt: "desc" }, take: 12 },
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
            take: 8,
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
  const onboardingComplete = client.onboardingChecklist.filter((i) => i.status === "COMPLETE");
  const onboardingMissing = client.onboardingChecklist.filter((i) => i.status === "MISSING");

  return (
    <div className="gc-fade-up">
      <div className="mb-8 gc-panel-ice gc-panel p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div>
            <p className="gc-eyebrow mb-2">{client.grantsClientId}</p>
            <h1 className="text-4xl md:text-5xl mb-2">
              {client.firstName} {client.lastName}
            </h1>
            <p className="text-sm text-[var(--gc-muted)] mb-4">
              {client.email}
              {client.phone ? ` · ${client.phone}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="gc-status gc-status-ice">{client.stage.replaceAll("_", " ")}</span>
              <span className="gc-status">{client.status}</span>
              <span
                className={`gc-status ${
                  client.urgency === "HIGH" || client.urgency === "CRITICAL" ? "gc-status-danger" : ""
                }`}
              >
                {client.urgency}
              </span>
            </div>
          </div>
          <div className="min-w-[240px] gc-card">
            <p className="text-[0.62rem] tracking-[0.16em] uppercase text-[var(--gc-ice)] mb-2">Next action</p>
            <p className="font-medium mb-1">{client.nextAction || "Define next action"}</p>
            <p className="text-xs text-[var(--gc-muted)]">
              Owner: {client.nextActionOwner || "—"}
              {client.nextDueAt ? ` · due ${client.nextDueAt.toLocaleDateString()}` : ""}
            </p>
            <p className="text-xs text-[var(--gc-muted)] mt-2">
              Assigned:{" "}
              {client.assignments.length
                ? client.assignments.map((a) => `${a.staff.firstName} ${a.staff.lastName}`).join(", ")
                : "Unassigned"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
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

      <div className="grid lg:grid-cols-2 gap-8 mt-10">
        <section>
          <h2 className="text-2xl mb-3">Onboarding</h2>
          <p className="text-sm text-[var(--gc-muted)] mb-4">
            {onboardingComplete.length} complete · {onboardingMissing.length} missing
          </p>
          <div className="space-y-2">
            {client.onboardingChecklist.map((item) => (
              <div key={item.id} className="flex justify-between gap-3 py-2 border-b border-[var(--gc-border)]">
                <span className="text-sm">{item.label}</span>
                <span className={`gc-status ${item.status === "COMPLETE" ? "gc-status-ok" : "gc-status-warn"}`}>
                  {item.status}
                </span>
              </div>
            ))}
            {client.onboardingChecklist.length === 0 && (
              <p className="text-sm text-[var(--gc-muted)]">No checklist configured.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-2xl mb-3">Enrollment & Pay</h2>
          {showFinance ? (
            <div className="space-y-3">
              {client.clientServices.map((cs) => (
                <div key={cs.id} className="gc-card">
                  <p className="font-medium">{cs.service.name}</p>
                  <p className="text-xs text-[var(--gc-muted)]">
                    {cs.status} · policy {cs.billingPolicy?.name || "—"}
                  </p>
                </div>
              ))}
              {invoices.map((inv) => (
                <div key={inv.id} className="flex justify-between gap-3 py-2 border-b border-[var(--gc-border)]">
                  <div>
                    <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-[var(--gc-muted)]">{inv.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="display text-xl">{formatUsd(inv.amountCents)}</p>
                    {(inv.status === "DUE" || inv.status === "FAILED") && (
                      <Link href={`/pay/${inv.invoiceNumber}`} className="text-[0.65rem] uppercase tracking-wider text-[var(--gc-gold)]">
                        Open Grants Pay
                      </Link>
                    )}
                  </div>
                </div>
              ))}
              <h3 className="text-lg mt-4 mb-2">Payment timeline</h3>
              {transactions.map((t) => (
                <div key={t.id} className="text-sm flex justify-between py-2 border-b border-[var(--gc-border)]">
                  <span>
                    {t.status} · settle {t.settlementStatus} · payout {t.payoutStatus}
                  </span>
                  <span>{formatUsd(t.amountCents)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--gc-muted)]">Financial details restricted for your role.</p>
          )}
        </section>
      </div>

      <section className="mt-10">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-2xl">Score Intelligence</h2>
          <Link href="/credit-pulse" className="text-[0.7rem] tracking-[0.14em] uppercase text-[var(--gc-ice)]">
            Credit Pulse
          </Link>
        </div>
        <ScoreIntelligencePanel groups={scoreIntel} />
      </section>

      <section className="mt-10">
        <h2 className="text-2xl mb-4">Dispute process</h2>
        <div className="space-y-3">
          {client.disputeRounds.map((r) => (
            <div key={r.id} className="gc-card">
              <div className="flex justify-between gap-3">
                <p className="font-medium">Round {r.roundNumber}</p>
                <span className="gc-status">{r.status.replaceAll("_", " ")}</span>
              </div>
              <p className="text-sm text-[var(--gc-muted)] mt-2">
                Prepared {r.preparedAt?.toLocaleDateString() || "—"} · Sent {r.sentAt?.toLocaleDateString() || "—"} ·
                Results {r.resultsReceivedAt?.toLocaleDateString() || "—"}
              </p>
              <p className="text-sm mt-1">
                Negative {r.negativeItemsCount} · Deleted {r.deletedItemsCount} · Remaining {r.remainingItemsCount}
              </p>
            </div>
          ))}
          {client.disputeRounds.length === 0 && (
            <p className="text-sm text-[var(--gc-muted)]">No dispute rounds tracked yet.</p>
          )}
          <a
            className="gc-btn gc-btn-outline inline-flex"
            href={
              client.identifiers.find((i) => i.provider === "DISPUTEFOX")
                ? `https://app.disputefox.com/`
                : "#"
            }
            target="_blank"
            rel="noreferrer"
          >
            Open dispute workspace
          </a>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-8 mt-10">
        <section>
          <h2 className="text-2xl mb-4">Communication</h2>
          <div className="space-y-3">
            {[...(clientConv?.messages || []), ...(internalConv?.messages || [])]
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .slice(0, 8)
              .map((m) => (
                <div key={m.id} className={m.isInternal ? "gc-bubble-internal" : "gc-bubble-client"}>
                  <p className={`gc-bubble-label ${m.isInternal ? "internal" : "client"}`}>
                    {m.isInternal ? "Internal" : "Client"}
                    {m.sender ? ` · ${m.sender.firstName}` : ""}
                  </p>
                  <p className="text-sm">{m.body}</p>
                </div>
              ))}
          </div>
        </section>
        <section>
          <h2 className="text-2xl mb-4">Documents & tasks</h2>
          <div className="space-y-2 mb-6">
            {client.documents.map((d) => (
              <div key={d.id} className="flex justify-between text-sm py-2 border-b border-[var(--gc-border)]">
                <span>{d.name}</span>
                <span className="text-[var(--gc-muted)]">{d.category || "file"}</span>
              </div>
            ))}
            {client.documents.length === 0 && (
              <p className="text-sm text-[var(--gc-muted)]">No documents uploaded.</p>
            )}
          </div>
          <div className="space-y-2">
            {client.tasks.map((t) => (
              <div key={t.id} className="gc-card">
                <p className="font-medium text-sm">{t.title}</p>
                <p className="text-xs text-[var(--gc-muted)]">
                  {t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "Unassigned"} · {t.priority}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-10 mb-6">
        <h2 className="text-2xl mb-4">Journey timeline</h2>
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
      </section>
    </div>
  );
}
