import Link from "next/link";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { requireTaxStaff } from "@/lib/tax/access";
import { listTaxDeskBoard } from "@/lib/tax/desk";
import { probeSbtpgHealth } from "@/lib/tax/health";
import { SBTPG_STATUSES, taxDeskCatalog, taxStatusLabel } from "@/lib/tax/catalog";
import { TaxDeskAttachForm } from "@/components/tax/TaxDeskAttachForm";
import { TaxDeskSessionForm } from "@/components/tax/TaxDeskSessionForm";
import { SbtpgPayoutForm } from "@/components/tax/SbtpgPayoutForm";
import { DeskEmptyState } from "@/components/desk/DeskEmptyState";
import { formatUsd } from "@/lib/payments/dashboard";
import { listSbtpgPayouts } from "@/lib/tax/payouts";

export default async function SbtpgWorkspacePage() {
  const { user, denied } = await requireTaxStaff();
  if (denied || !user) return <p>Access denied.</p>;

  const catalog = taxDeskCatalog("SBTPG");
  const [board, probe, clients, payouts] = await Promise.all([
    listTaxDeskBoard("SBTPG"),
    probeSbtpgHealth(),
    prisma.client.findMany({
      orderBy: { lastName: "asc" },
      take: 200,
      select: { id: true, grantsClientId: true, firstName: true, lastName: true },
    }),
    listSbtpgPayouts(),
  ]);
  const canManage = hasPermission(user.role, "MANAGE_OPERATIONS");
  const openCount = board.filter((row) => row.status && row.status !== "CLOSED" && row.status !== "PAID").length;
  const paidCount = board.filter((row) => row.status === "PAID" || row.status === "FUNDED").length;
  const trackedCents = payouts
    .filter((row) => row.status === "PAID" || row.status === "FUNDED")
    .reduce((sum, row) => sum + row.amountCents, 0);

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">{catalog.eyebrow}</p>
      <h1 className="text-4xl md:text-5xl mb-2">SBTPG payouts</h1>
      <p className="gc-section-sub mb-6 max-w-3xl">{catalog.honesty}</p>

      <div className="gc-grid-dense gc-grid-dense-4 mb-8">
        {[
          ["Clients", String(board.length)],
          ["Open payouts", String(openCount)],
          ["Funded / paid", String(paidCount)],
          ["Tracked", formatUsd(trackedCents)],
        ].map(([label, value]) => (
          <div key={label} className="gc-card">
            <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">{label}</p>
            <p className="display text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="gc-card mb-10 max-w-3xl">
        <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">API health</p>
        <p className="text-lg display">{probe.status.replaceAll("_", " ")}</p>
        <p className="text-sm text-[var(--gc-muted)] mt-2">{probe.detail}</p>
        {probe.lastSuccessAt ? (
          <p className="text-sm text-[var(--gc-muted)] mt-1">
            Last recorded operation {new Date(probe.lastSuccessAt).toLocaleString()}
          </p>
        ) : null}
      </div>

      {board.length === 0 && payouts.length === 0 ? (
        <DeskEmptyState
          detail="No OS-recorded SBTPG payouts yet. Official pro.sbtpg.com is last-step only — this desk does not scrape."
          nextAction="Attach a Grants client, record a payout session, or import official payout totals so Command Center collected is not $0."
        />
      ) : null}

      {canManage ? (
        <div className="mb-10 space-y-6">
          <SbtpgPayoutForm clients={clients} />
          <div className="grid gap-6 lg:grid-cols-2">
            <TaxDeskAttachForm desk="SBTPG" clients={clients} />
            <TaxDeskSessionForm desk="SBTPG" clients={clients} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--gc-muted)] mb-10">View only — processing can record attach and sessions.</p>
      )}

      {payouts.length > 0 ? (
        <section className="mb-10">
          <h2 className="text-2xl mb-3">
            Recorded payouts <span className="text-[var(--gc-muted)] text-base">({payouts.length})</span>
          </h2>
          <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
            {payouts.map((row) => (
              <div key={row.id} className="py-4 flex justify-between gap-4">
                <div>
                  <p className="font-medium">{formatUsd(row.amountCents)}</p>
                  <p className="text-sm text-[var(--gc-muted)]">
                    {row.client
                      ? `${row.client.firstName} ${row.client.lastName} · ${row.client.grantsClientId}`
                      : "Firm / period total"}
                    {row.externalId ? ` · ${row.externalId}` : ""}
                    {row.paidAt ? ` · ${row.paidAt.toLocaleDateString()}` : ""}
                    {row.notes ? ` · ${row.notes}` : ""}
                  </p>
                </div>
                <span className="gc-status">{row.status}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {board.length > 0 && SBTPG_STATUSES.map((status) => {
        const rows = board.filter((row) => row.status === status);
        return (
          <section key={status} className="mb-8">
            <h2 className="text-2xl mb-3">
              {taxStatusLabel(status)} <span className="text-[var(--gc-muted)] text-base">({rows.length})</span>
            </h2>
            <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
              {rows.length === 0 ? (
                <p className="py-4 text-sm text-[var(--gc-muted)]">Clear.</p>
              ) : (
                rows.map((row) => (
                  <Link
                    key={row.id}
                    href={`/tax/sbtpg/${row.grantsClientId}`}
                    className="py-4 flex justify-between gap-4"
                  >
                    <div>
                      <p className="font-medium">
                        {row.firstName} {row.lastName} · {row.grantsClientId}
                      </p>
                      <p className="text-sm text-[var(--gc-muted)]">
                        SBTPG {row.deskId || "not attached"}
                        {row.amountCents != null ? ` · ${formatUsd(row.amountCents)}` : ""}
                        {row.lastSessionAt ? ` · session ${row.lastSessionAt.toLocaleDateString()}` : ""}
                        {row.deskNextAction ? ` · ${row.deskNextAction}` : ""}
                      </p>
                    </div>
                    <span className="gc-status">{taxStatusLabel(status)}</span>
                  </Link>
                ))
              )}
            </div>
          </section>
        );
      })}

      <section>
        <h2 className="text-2xl mb-3">
          Clients without a payout status{" "}
          <span className="text-[var(--gc-muted)] text-base">({board.filter((row) => !row.status).length})</span>
        </h2>
        <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
          {board.filter((row) => !row.status).length === 0 ? (
            <p className="py-4 text-sm text-[var(--gc-muted)]">
              {board.length === 0
                ? "No attached SBTPG clients or recorded payouts yet. Attach a Grants client and record payout status."
                : "Clear."}
            </p>
          ) : (
            board
              .filter((row) => !row.status)
              .map((row) => (
                <Link
                  key={row.id}
                  href={`/tax/sbtpg/${row.grantsClientId}`}
                  className="py-4 flex justify-between gap-4"
                >
                  <div>
                    <p className="font-medium">
                      {row.firstName} {row.lastName} · {row.grantsClientId}
                    </p>
                    <p className="text-sm text-[var(--gc-muted)]">
                      SBTPG {row.deskId || "not attached"}
                      {row.deskNextAction ? ` · ${row.deskNextAction}` : ""}
                    </p>
                  </div>
                  <span className="gc-status">{row.stage.replaceAll("_", " ")}</span>
                </Link>
              ))
          )}
        </div>
      </section>
    </div>
  );
}
