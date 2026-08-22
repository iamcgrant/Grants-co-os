import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getFinanceDashboard, formatUsd } from "@/lib/payments/dashboard";
import { prisma } from "@/lib/db/prisma";
import { MetricTile, Panel } from "@/components/ui/density";
import { getGcEnvironment } from "@/lib/integrations/env";
import { CreatePaymentRequestForm } from "@/components/pay/CreatePaymentRequestForm";
import { InvoiceDocument } from "@/components/pay/InvoiceDocument";
import { commasHonestHealth, commasPublicStatus } from "@/lib/payments/commas-config";
import { commasLastStepUrl } from "@/lib/payments/commas-checkout-url";
import { getPaymentProvider } from "@/lib/payments/provider";

export default async function GrantsPayPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_FINANCE_DASHBOARD")) {
    return (
      <div>
        <h1 className="text-3xl mb-2">Grants Pay</h1>
        <p className="text-[var(--gc-muted)]">Finance access is limited for this role.</p>
      </div>
    );
  }

  const { filter, tab: tabRaw } = await searchParams;
  const tab = tabRaw === "payouts" || tabRaw === "disputes" ? tabRaw : "payments";
  const finance = await getFinanceDashboard();
  const dataPlane = getGcEnvironment();
  const paymentProvider = process.env.PAYMENT_PROVIDER || "mock";
  const commas = commasPublicStatus();
  const lastCommasWebhook = await prisma.webhookEvent.findFirst({
    where: { status: "PROCESSED", provider: { in: ["commas", "grants_pay"] } },
    orderBy: { processedAt: "desc" },
    select: { processedAt: true },
  });
  const lastCommasCheckout = await prisma.paymentLink.findFirst({
    where: { provider: "commas", providerSessionId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const commasHealth = commasHonestHealth({
    lastWebhookAt: lastCommasWebhook?.processedAt?.toISOString() || null,
    lastCheckoutAt: lastCommasCheckout?.createdAt.toISOString() || null,
    paymentProvider: getPaymentProvider().name,
  });

  const paymentRequests = await prisma.paymentRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      client: { select: { grantsClientId: true, firstName: true, lastName: true, email: true } },
      invoice: { include: { items: true } },
      links: { take: 1, orderBy: { createdAt: "desc" } },
    },
  });
  const recentInvoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      client: { select: { grantsClientId: true, firstName: true, lastName: true, email: true } },
      items: true,
      paymentRequests: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { links: { take: 1, orderBy: { createdAt: "desc" } } },
      },
    },
  });

  const transactions = await prisma.paymentTransaction.findMany({
    where: filter === "failed" ? { status: "FAILED" } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      client: { select: { grantsClientId: true, firstName: true, lastName: true } },
      invoice: { select: { invoiceNumber: true, description: true } },
      refunds: true,
      disputes: true,
      payouts: true,
    },
  });

  const disputes = await prisma.paymentDispute.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      client: { select: { grantsClientId: true, firstName: true, lastName: true } },
    },
  });

  const payoutRows = await prisma.payout.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      transaction: {
        include: { client: { select: { grantsClientId: true, firstName: true, lastName: true } } },
      },
    },
  });

  return (
    <div className="gc-fade-up space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="gc-eyebrow mb-2">Proprietary finance module</p>
          <h1 className="text-3xl md:text-4xl mb-1">Grants Pay</h1>
          <p className="text-sm text-[var(--gc-muted)] max-w-2xl">
            Authorization, settlement, and payout stay distinct. Success ≠ deposited.
            {" · "}
            {dataPlane} data plane
            {" · "}
            {paymentProvider === "mock"
              ? `Manual Commas mode · ${commasHealth.status.replaceAll("_", " ")}`
              : `Provider ${paymentProvider} · ${commasHealth.status.replaceAll("_", " ")}`}
          </p>
        </div>
        <Link href="/home" className="gc-btn gc-btn-outline">
          Command Center
        </Link>
      </div>

      {hasPermission(user.role, "MANAGE_PAYMENTS") ? (
        <Panel title="Create invoice" eyebrow="Native OS desk · Commas last-step only">
          <CreatePaymentRequestForm commas={commasHealth} />
        </Panel>
      ) : null}

      <Panel title="Invoices" eyebrow="Luxury OS invoices · not a link farm">
        <div className="space-y-6">
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-[var(--gc-muted)] py-3">No invoices yet.</p>
          ) : (
            recentInvoices.map((inv) => {
              const request = inv.paymentRequests[0];
              return (
                <InvoiceDocument
                  key={inv.id}
                  staffHref={`/pay/invoices/${inv.invoiceNumber}`}
                  invoice={{
                    invoiceNumber: inv.invoiceNumber,
                    status: inv.status,
                    amountCents: inv.amountCents,
                    amountPaidCents: inv.amountPaidCents,
                    description: inv.description,
                    dueAt: inv.dueAt,
                    createdAt: inv.createdAt,
                    clientName: `${inv.client.firstName} ${inv.client.lastName}`,
                    grantsClientId: inv.client.grantsClientId,
                    clientEmail: inv.client.email,
                    paymentRequestPublicId: request?.publicId || null,
                    items: inv.items,
                    lastStepUrl: commasLastStepUrl(request?.links[0]?.url),
                    osPayPath: `/pay/${inv.invoiceNumber}`,
                  }}
                />
              );
            })
          )}
        </div>
      </Panel>

      <Panel title="Payment requests">
        <div className="divide-y divide-[var(--gc-border)]">
          {paymentRequests.length === 0 ? (
            <p className="text-sm text-[var(--gc-muted)] py-3">No payment requests yet.</p>
          ) : (
            paymentRequests.map((pr) => (
              <div key={pr.id} className="py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">
                    {pr.publicId} · {pr.client.firstName} {pr.client.lastName}
                  </p>
                  <p className="text-[var(--gc-muted)]">
                    {pr.client.grantsClientId}
                    {pr.invoice ? ` · ${pr.invoice.invoiceNumber}` : ""}
                    {" · "}
                    {pr.status}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span>{formatUsd(pr.amountCents)}</span>
                  {pr.invoice ? (
                    <Link href={`/pay/invoices/${pr.invoice.invoiceNumber}`} className="text-[var(--gc-gold)]">
                      Invoice
                    </Link>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <div className="gc-dash-grid gc-dash-grid-4">
        <MetricTile label="Collected today" value={formatUsd(finance.collectedTodayCents)} tone="ice" />
        <MetricTile label="Pending settlement" value={formatUsd(finance.pendingSettlementCents)} tone="warn" />
        <MetricTile label="Payouts pending" value={formatUsd(finance.payoutsPendingCents)} />
        <MetricTile label="Failed" value={formatUsd(finance.failedPaymentsCents)} href="/pay?filter=failed" tone="danger" />
      </div>

      <div className="gc-tabs">
        <Link href="/pay" className={`gc-tab ${tab === "payments" ? "gc-tab-active" : ""}`}>Payments</Link>
        <Link href="/pay?tab=payouts" className={`gc-tab ${tab === "payouts" ? "gc-tab-active" : ""}`}>Payouts</Link>
        <Link href="/pay?tab=disputes" className={`gc-tab ${tab === "disputes" ? "gc-tab-active" : ""}`}>Disputes</Link>
      </div>

      {tab === "payments" && (
        <Panel title="Payment ledger" eyebrow={`${transactions.length} recent`}>
          <div className="overflow-x-auto">
            <table className="gc-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Invoice</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Settlement</th>
                  <th>Payout</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/clients/${t.client.grantsClientId}`} className="font-medium hover:underline">
                        {t.client.firstName} {t.client.lastName}
                      </Link>
                      <p className="text-[0.65rem] text-[var(--gc-muted)]">{t.client.grantsClientId}</p>
                    </td>
                    <td className="text-[var(--gc-muted)]">{t.invoice?.invoiceNumber || "—"}</td>
                    <td className="display">{formatUsd(t.amountCents)}</td>
                    <td>
                      <span className={`gc-status ${t.status === "FAILED" ? "gc-status-danger" : t.status === "SUCCEEDED" ? "gc-status-ok" : ""}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="text-[var(--gc-muted)]">{t.settlementStatus}</td>
                    <td className="text-[var(--gc-muted)]">{t.payoutStatus}</td>
                    <td className="text-[var(--gc-muted)]">{t.createdAt.toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === "payouts" && (
        <Panel title="Payouts">
          <table className="gc-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Arrived</th>
              </tr>
            </thead>
            <tbody>
              {payoutRows.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.transaction
                      ? `${p.transaction.client.firstName} ${p.transaction.client.lastName}`
                      : "—"}
                  </td>
                  <td className="display">{formatUsd(p.amountCents)}</td>
                  <td><span className="gc-status gc-status-ok">{p.status}</span></td>
                  <td className="text-[var(--gc-muted)]">{p.arrivedAt?.toLocaleDateString() || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {tab === "disputes" && (
        <Panel title="Payment disputes / chargebacks">
          <table className="gc-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/clients/${d.client.grantsClientId}`}>
                      {d.client.firstName} {d.client.lastName}
                    </Link>
                  </td>
                  <td>{formatUsd(d.amountCents)}</td>
                  <td className="text-[var(--gc-muted)]">{d.reason}</td>
                  <td><span className="gc-status gc-status-danger">{d.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {disputes.length === 0 && <p className="text-sm text-[var(--gc-muted)] py-4">No open disputes.</p>}
        </Panel>
      )}
    </div>
  );
}
