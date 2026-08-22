import Link from "next/link";
import { hasPermission } from "@/lib/rbac/permissions";
import { requireCreditStaff } from "@/lib/disputes/access";
import { loadSmartCreditDeskSafe } from "@/lib/disputes/desk-load";
import { DISPUTE_CASE_STATUSES, channelCatalog, statusLabel } from "@/lib/disputes/channels";
import { NewCaseForm } from "@/components/disputes/NewCaseForm";
import { SmartCreditAttachForm } from "@/components/credit/SmartCreditAttachForm";
import { SmartCreditSessionForm } from "@/components/credit/SmartCreditSessionForm";
import { DeskEmptyState } from "@/components/desk/DeskEmptyState";

export default async function SmartCreditWorkspacePage() {
  const { user, denied } = await requireCreditStaff();
  if (denied || !user) return <p>Access denied.</p>;

  const catalog = channelCatalog("SMARTCREDIT");
  const { board, probe, clients, loadError } = await loadSmartCreditDeskSafe();
  const canManage = hasPermission(user.role, "MANAGE_CREDIT");
  const openCases = board.filter((row) => row.case && row.case.status !== "CLOSED");
  const itemCount = board.reduce((sum, row) => sum + (row.case?.items.length ?? 0), 0);
  const sessionCount = board.filter((row) => row.connection?.lastSyncedAt).length;

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">{catalog.eyebrow}</p>
      <h1 className="text-4xl md:text-5xl mb-2">SmartCredit</h1>
      <p className="gc-section-sub mb-6 max-w-3xl">{catalog.honesty}</p>

      <div className="gc-grid-dense gc-grid-dense-4 mb-8">
        {[
          ["Clients", String(board.length)],
          ["Open cases", String(openCases.length)],
          ["Items", String(itemCount)],
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
          detail={loadError ? `${catalog.honesty} ${loadError}` : catalog.honesty}
          nextAction="Attach a Grants client, record a session, or open a SmartCredit case. No scrape."
          loginUrl={catalog.officialSubmitUrl}
        />
      ) : null}

      {canManage ? (
        <div className="mb-10 grid gap-6 lg:grid-cols-2">
          <SmartCreditAttachForm clients={clients} />
          <SmartCreditSessionForm clients={clients} />
          <div className="lg:col-span-2">
            <NewCaseForm channel="SMARTCREDIT" clients={clients} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--gc-muted)] mb-10">View only — processing can record attach and sessions.</p>
      )}

      {(board.length > 0 ? DISPUTE_CASE_STATUSES : []).map((status) => {
        const rows = board.filter((row) => row.case?.status === status);
        return (
          <section key={status} className="mb-8">
            <h2 className="text-2xl mb-3">
              {statusLabel(status)} <span className="text-[var(--gc-muted)] text-base">({rows.length})</span>
            </h2>
            <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
              {rows.length === 0 ? (
                <p className="py-4 text-sm text-[var(--gc-muted)]">Clear.</p>
              ) : (
                rows.map((row) => (
                  <Link
                    key={row.id}
                    href={`/credit/smartcredit/${row.grantsClientId}`}
                    className="py-4 flex justify-between gap-4"
                  >
                    <div>
                      <p className="font-medium">
                        {row.firstName} {row.lastName} · {row.grantsClientId}
                      </p>
                      <p className="text-sm text-[var(--gc-muted)]">
                        SC id {row.smartCreditId || "not attached"} · items {row.case?.items.length ?? 0}
                        {row.connection?.lastSyncedAt
                          ? ` · session ${row.connection.lastSyncedAt.toLocaleDateString()}`
                          : ""}
                        {row.case?.outcome ? ` · ${row.case.outcome}` : ""}
                        {row.nextAction ? ` · ${row.nextAction}` : ""}
                      </p>
                    </div>
                    <span className="gc-status">{statusLabel(status)}</span>
                  </Link>
                ))
              )}
            </div>
          </section>
        );
      })}

      <section>
        <h2 className="text-2xl mb-3">
          Clients without an open case{" "}
          <span className="text-[var(--gc-muted)] text-base">({board.filter((row) => !row.case).length})</span>
        </h2>
        <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
          {board.filter((row) => !row.case).length === 0 ? (
            <p className="py-4 text-sm text-[var(--gc-muted)]">
              {board.length === 0
                ? "No attached SmartCredit clients or OS cases yet. Attach a Grants client and open a case to start the packet."
                : "Clear."}
            </p>
          ) : (
            board
              .filter((row) => !row.case)
              .map((row) => (
                <Link
                  key={row.id}
                  href={`/credit/smartcredit/${row.grantsClientId}`}
                  className="py-4 flex justify-between gap-4"
                >
                  <div>
                    <p className="font-medium">
                      {row.firstName} {row.lastName} · {row.grantsClientId}
                    </p>
                    <p className="text-sm text-[var(--gc-muted)]">
                      SC id {row.smartCreditId || "not attached"}
                      {row.connection?.status ? ` · ${row.connection.status.replaceAll("_", " ")}` : ""}
                      {row.nextAction ? ` · ${row.nextAction}` : ""}
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
