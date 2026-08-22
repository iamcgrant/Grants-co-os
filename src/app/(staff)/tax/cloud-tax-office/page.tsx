import Link from "next/link";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { requireTaxStaff } from "@/lib/tax/access";
import { listTaxDeskBoard } from "@/lib/tax/desk";
import { probeCloudTaxOfficeHealth } from "@/lib/tax/health";
import { CLOUD_TAX_STATUSES, taxDeskCatalog, taxStatusLabel } from "@/lib/tax/catalog";
import { TaxDeskAttachForm } from "@/components/tax/TaxDeskAttachForm";
import { TaxDeskSessionForm } from "@/components/tax/TaxDeskSessionForm";
import { DeskEmptyState } from "@/components/desk/DeskEmptyState";

export default async function CloudTaxOfficePage() {
  const { user, denied } = await requireTaxStaff();
  if (denied || !user) return <p>Access denied.</p>;

  const catalog = taxDeskCatalog("CLOUD_TAX_OFFICE");
  const [board, probe, clients] = await Promise.all([
    listTaxDeskBoard("CLOUD_TAX_OFFICE"),
    probeCloudTaxOfficeHealth(),
    prisma.client.findMany({
      orderBy: { lastName: "asc" },
      take: 200,
      select: { id: true, grantsClientId: true, firstName: true, lastName: true },
    }),
  ]);
  const canManage = hasPermission(user.role, "MANAGE_OPERATIONS");
  const openCount = board.filter((row) => row.status && row.status !== "CLOSED").length;
  const filedCount = board.filter((row) => row.status === "FILED" || row.status === "ACCEPTED").length;
  const sessionCount = board.filter((row) => row.lastSessionAt).length;

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">{catalog.eyebrow}</p>
      <h1 className="text-4xl md:text-5xl mb-2">Cloud Tax Office</h1>
      <p className="gc-section-sub mb-6 max-w-3xl">{catalog.honesty}</p>

      <div className="gc-grid-dense gc-grid-dense-4 mb-8">
        {[
          ["Returns", String(board.length)],
          ["Open", String(openCount)],
          ["Filed / accepted", String(filedCount)],
          ["Sessions recorded", String(sessionCount)],
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

      {board.length === 0 ? (
        <DeskEmptyState
          detail={catalog.honesty}
          nextAction="Attach a Grants client and record a return session. Official Cloud Tax Office is last-step only."
        />
      ) : null}

      {canManage ? (
        <div className="mb-10 grid gap-6 lg:grid-cols-2">
          <TaxDeskAttachForm desk="CLOUD_TAX_OFFICE" clients={clients} />
          <TaxDeskSessionForm desk="CLOUD_TAX_OFFICE" clients={clients} />
        </div>
      ) : (
        <p className="text-sm text-[var(--gc-muted)] mb-10">View only — processing can record attach and sessions.</p>
      )}

      {(board.length > 0 ? CLOUD_TAX_STATUSES : []).map((status) => {
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
                    href={`/tax/cloud-tax-office/${row.grantsClientId}`}
                    className="py-4 flex justify-between gap-4"
                  >
                    <div>
                      <p className="font-medium">
                        {row.firstName} {row.lastName} · {row.grantsClientId}
                      </p>
                      <p className="text-sm text-[var(--gc-muted)]">
                        Return {row.deskId || "not attached"}
                        {row.taxYear ? ` · ${row.taxYear}` : ""}
                        {row.lastSessionAt ? ` · session ${row.lastSessionAt.toLocaleDateString()}` : ""}
                        {row.deskNextAction ? ` · ${row.deskNextAction}` : row.nextAction ? ` · ${row.nextAction}` : ""}
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
          Clients without a return status{" "}
          <span className="text-[var(--gc-muted)] text-base">({board.filter((row) => !row.status).length})</span>
        </h2>
        <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
          {board.filter((row) => !row.status).length === 0 ? (
            <p className="py-4 text-sm text-[var(--gc-muted)]">
              {board.length === 0
                ? "No attached Cloud Tax Office clients or recorded sessions yet. Attach a Grants client and record status to start."
                : "Clear."}
            </p>
          ) : (
            board
              .filter((row) => !row.status)
              .map((row) => (
                <Link
                  key={row.id}
                  href={`/tax/cloud-tax-office/${row.grantsClientId}`}
                  className="py-4 flex justify-between gap-4"
                >
                  <div>
                    <p className="font-medium">
                      {row.firstName} {row.lastName} · {row.grantsClientId}
                    </p>
                    <p className="text-sm text-[var(--gc-muted)]">
                      Return {row.deskId || "not attached"}
                      {row.deskNextAction ? ` · ${row.deskNextAction}` : row.nextAction ? ` · ${row.nextAction}` : ""}
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
