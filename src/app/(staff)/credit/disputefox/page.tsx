import Link from "next/link";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { requireCreditStaff } from "@/lib/disputes/access";
import { listDisputeFoxBoard } from "@/lib/disputes/cases";
import { DISPUTE_CASE_STATUSES, channelCatalog, statusLabel } from "@/lib/disputes/channels";
import { probeDisputeFoxApi } from "@/lib/integrations/disputefox/probe";
import { NewCaseForm } from "@/components/disputes/NewCaseForm";
import { DeskEmptyState } from "@/components/desk/DeskEmptyState";

export default async function DisputeFoxWorkspacePage() {
  const { user, denied } = await requireCreditStaff();
  if (denied || !user) return <p>Access denied.</p>;

  const catalog = channelCatalog("DISPUTEFOX");
  const [board, probe, clients] = await Promise.all([
    listDisputeFoxBoard(),
    probeDisputeFoxApi(),
    prisma.client.findMany({
      orderBy: { lastName: "asc" },
      take: 200,
      select: { id: true, grantsClientId: true, firstName: true, lastName: true },
    }),
  ]);
  const canManage = hasPermission(user.role, "MANAGE_CREDIT");
  const openCases = board.filter((row) => row.case && row.case.status !== "CLOSED");
  const itemCount = board.reduce((sum, row) => sum + (row.case?.items.length ?? 0), 0);
  const readyCount = board.filter((row) => row.case?.status === "READY").length;

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">{catalog.eyebrow}</p>
      <h1 className="text-4xl md:text-5xl mb-2">DisputeFox</h1>
      <p className="gc-section-sub mb-6 max-w-3xl">{catalog.honesty}</p>

      <div className="gc-grid-dense gc-grid-dense-4 mb-8">
        {[
          ["Clients", String(board.length)],
          ["Open cases", String(openCases.length)],
          ["Items", String(itemCount)],
          ["Ready to submit", String(readyCount)],
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
      </div>

      {board.length === 0 ? (
        <DeskEmptyState
          detail={catalog.honesty}
          nextAction="Open a DisputeFox case for a Grants client. Live list/get stays off. No scrape."
          loginUrl={catalog.officialSubmitUrl}
        />
      ) : null}

      {canManage ? (
        <div className="mb-10">
          <NewCaseForm
            channel="DISPUTEFOX"
            clients={clients}
            detailHref={(id) => `/credit/disputefox/case/${id}`}
          />
        </div>
      ) : null}

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
                    href={`/credit/disputefox/${row.grantsClientId}`}
                    className="py-4 flex justify-between gap-4"
                  >
                    <div>
                      <p className="font-medium">
                        {row.firstName} {row.lastName} · {row.grantsClientId}
                      </p>
                      <p className="text-sm text-[var(--gc-muted)]">
                        DF id {row.disputeFoxId || "not attached"} · items {row.case?.items.length ?? 0} ·{" "}
                        {row.latestRound
                          ? `round ${row.latestRound.roundNumber} ${row.latestRound.status}`
                          : "no letter round"}
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
                ? "No attached DisputeFox clients or OS cases yet. Open a case for a Grants client to start the packet."
                : "Clear."}
            </p>
          ) : (
            board
              .filter((row) => !row.case)
              .map((row) => (
                <Link
                  key={row.id}
                  href={`/credit/disputefox/${row.grantsClientId}`}
                  className="py-4 flex justify-between gap-4"
                >
                  <div>
                    <p className="font-medium">
                      {row.firstName} {row.lastName} · {row.grantsClientId}
                    </p>
                    <p className="text-sm text-[var(--gc-muted)]">
                      DF id {row.disputeFoxId || "not attached"} ·{" "}
                      {row.latestRound
                        ? `round ${row.latestRound.roundNumber} ${row.latestRound.status}`
                        : "no letter round"}
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
