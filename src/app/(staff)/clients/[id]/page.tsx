import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessFinancialData, hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { getClientTimeline } from "@/lib/clients/timeline";
import { formatUsd } from "@/lib/payments/dashboard";
import { ClientActions } from "@/components/clients/ClientActions";

export default async function ClientDetailPage({
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
      clientServices: {
        include: { service: true, billingPolicy: true, milestones: true },
      },
      creditScores: { orderBy: { capturedAt: "desc" }, take: 12 },
      creditConnections: {
        select: { provider: true, status: true, needsReauth: true, lastSyncedAt: true },
      },
    },
  });
  if (!client) notFound();

  const timeline = await getClientTimeline(client.id);
  const showFinance = canAccessFinancialData(user.role);

  const invoices = showFinance
    ? await prisma.invoice.findMany({
        where: { clientId: client.id },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const transactions = showFinance
    ? await prisma.paymentTransaction.findMany({
        where: { clientId: client.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div>
      <div className="gc-fade-up mb-8">
        <p className="text-[0.7rem] tracking-[0.3em] uppercase text-[var(--gc-champagne-dim)] mb-2">
          {client.grantsClientId}
        </p>
        <h1 className="text-4xl md:text-5xl mb-2">
          {client.firstName} {client.lastName}
        </h1>
        <p className="text-sm text-[var(--gc-muted)]">
          {client.email}
          {client.phone ? ` · ${client.phone}` : ""}
        </p>
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

      {showFinance && (
        <section className="mt-12 gc-fade-up-delay">
          <h2 className="text-2xl mb-4">Financial Profile</h2>
          <div className="space-y-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex justify-between gap-4 py-3 border-b border-[var(--gc-border)]">
                <div>
                  <p className="font-medium">{inv.invoiceNumber}</p>
                  <p className="text-xs text-[var(--gc-muted)]">{inv.status}</p>
                </div>
                <div className="text-right">
                  <p>{formatUsd(inv.amountCents)}</p>
                  {(inv.status === "DUE" || inv.status === "FAILED") && (
                    <Link href={`/pay/${inv.invoiceNumber}`} className="text-[0.65rem] tracking-[0.12em] uppercase text-[var(--gc-champagne-dim)]">
                      Pay Securely
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
          <h3 className="text-lg mt-8 mb-3">Payments</h3>
          <div className="space-y-2 text-sm">
            {transactions.map((t) => (
              <div key={t.id} className="flex justify-between py-2 border-b border-[var(--gc-border)]">
                <span>
                  {t.status} · settlement {t.settlementStatus} · payout {t.payoutStatus}
                </span>
                <span>{formatUsd(t.amountCents)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!showFinance && (
        <p className="mt-8 text-sm text-[var(--gc-muted)]">
          Financial details are restricted for your role.
        </p>
      )}

      <section className="mt-12">
        <h2 className="text-2xl mb-4">Credit</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {client.creditScores.slice(0, 3).map((s) => (
            <div key={s.id} className="py-3 border-b border-[var(--gc-border)]">
              <p className="text-[0.65rem] tracking-[0.16em] uppercase text-[var(--gc-muted)]">
                {s.bureau}
              </p>
              <p className="display text-3xl">{s.score}</p>
              <p className="text-xs text-[var(--gc-muted)]">
                {s.scoringModel} · {s.source}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl mb-4">Timeline</h2>
        <div className="space-y-4">
          {timeline.map((e) => (
            <div key={e.id} className="border-l border-[var(--gc-champagne)] pl-4">
              <p className="font-medium">{e.title}</p>
              {e.description && (
                <p className="text-sm text-[var(--gc-muted)]">{e.description}</p>
              )}
              <p className="text-[0.65rem] tracking-[0.12em] uppercase text-[var(--gc-muted)] mt-1">
                {e.eventType} · {new Date(e.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl mb-4">External Identifiers</h2>
        <ul className="text-sm space-y-2">
          {client.identifiers.map((i) => (
            <li key={i.id} className="flex justify-between border-b border-[var(--gc-border)] py-2">
              <span>{i.provider}</span>
              <span className="text-[var(--gc-muted)]">{i.externalId}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
