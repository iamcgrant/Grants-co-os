import Link from "next/link";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  DISPUTE_CASE_STATUSES,
  channelCatalog,
  statusLabel,
  type DisputeCaseStatus,
  type DisputeChannel,
} from "@/lib/disputes/channels";
import { loadChannelDeskSafe } from "@/lib/disputes/desk-load";
import { CreditDeskUnavailable } from "@/components/disputes/CreditDeskUnavailable";
import { NewCaseForm } from "@/components/disputes/NewCaseForm";
import { DeskEmptyState } from "@/components/desk/DeskEmptyState";
import { OpenPortalLaunch } from "@/components/desk/OpenPortalLaunch";
import type { AuthUser } from "@/lib/auth/session";

function itemCountOf(row: { items?: unknown }): number {
  return Array.isArray(row.items) ? row.items.length : 0;
}

function checklistLabel(row: { checklist?: Array<{ done?: boolean }> | null }): string {
  const list = Array.isArray(row.checklist) ? row.checklist : [];
  return `${list.filter((item) => item.done).length}/${list.length}`;
}

function clientName(row: { client?: { firstName?: string | null; lastName?: string | null; grantsClientId?: string | null } | null }): string {
  const client = row.client;
  if (!client) return "Unknown client";
  return `${client.firstName ?? ""} ${client.lastName ?? ""} · ${client.grantsClientId ?? ""}`.trim();
}

export async function renderChannelDeskSafe(channel: DisputeChannel, user: AuthUser) {
  try {
    return await ChannelCasesView({ channel, user });
  } catch (error) {
    console.error(`[${channel}] desk render failed`, error);
    return <CreditDeskUnavailable channel={channel} />;
  }
}

export async function ChannelCasesView({
  channel,
  user,
}: {
  channel: DisputeChannel;
  user: AuthUser;
}) {
  const catalog = channelCatalog(channel);
  const { cases, clients, loadError } = await loadChannelDeskSafe(channel);
  const canManage = hasPermission(user.role, "MANAGE_CREDIT");
  const detailBase = catalog.href;
  const openCount = cases.filter((row) => row.status !== "CLOSED").length;
  const itemCount = cases.reduce((sum, row) => sum + itemCountOf(row), 0);
  const readyCount = cases.filter((row) => row.status === "READY").length;
  const submittedCount = cases.filter((row) => row.status === "SUBMITTED" || row.status === "RESULTS").length;

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">{catalog.eyebrow}</p>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        <h1 className="text-4xl md:text-5xl">{catalog.label}</h1>
        {catalog.officialSubmitUrl ? <OpenPortalLaunch href={catalog.officialSubmitUrl} /> : null}
      </div>
      <p className="gc-section-sub mb-8 max-w-3xl">{catalog.honesty}</p>

      <div className="gc-grid-dense gc-grid-dense-4 mb-10">
        {[
          ["Open cases", String(openCount)],
          ["Items", String(itemCount)],
          ["Ready to submit", String(readyCount)],
          ["Submitted / results", String(submittedCount)],
        ].map(([label, value]) => (
          <div key={label} className="gc-card">
            <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">{label}</p>
            <p className="display text-2xl">{value}</p>
          </div>
        ))}
      </div>

      {cases.length === 0 ? (
        <DeskEmptyState
          detail={loadError ? `${catalog.honesty} ${loadError}` : catalog.honesty}
          nextAction={
            canManage
              ? "Open a case for a Grants client below. Official portal is a last submit step only — this desk does not scrape."
              : "Ask processing to open a case. Official portal is last-step only."
          }
          loginUrl={catalog.officialSubmitUrl}
        />
      ) : null}

      {canManage ? (
        <div className="mb-10">
          <NewCaseForm channel={channel} clients={clients} />
        </div>
      ) : null}

      {(cases.length > 0 ? DISPUTE_CASE_STATUSES : []).map((status) => {
        const rows = cases.filter((row) => row.status === status);
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
                  <Link key={row.id} href={`${detailBase}/${row.id}`} className="py-4 flex justify-between gap-4">
                    <div>
                      <p className="font-medium">{clientName(row)}</p>
                      <p className="text-sm text-[var(--gc-muted)]">
                        {row.title} · {itemCountOf(row)} items · checklist {checklistLabel(row)}
                        {row.outcome ? ` · ${row.outcome}` : ""}
                      </p>
                    </div>
                    <span className="gc-status">{statusLabel(row.status as DisputeCaseStatus)}</span>
                  </Link>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
