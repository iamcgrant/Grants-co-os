import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { CreditSubnav } from "@/components/credit/CreditSubnav";
import { PortalWorkspace } from "@/components/portals/PortalWorkspace";
import { getPortalEntry } from "@/lib/portals/catalog";
import { listPortalClientOptions } from "@/lib/portals/clients";
import { listPortalSessions } from "@/lib/portals/service";
import { prisma } from "@/lib/db/prisma";

export default async function DisputeFoxWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_CREDIT_DOCS")) return <p>Access denied.</p>;

  const entry = getPortalEntry("DISPUTEFOX");
  const [clients, sessions, rounds] = await Promise.all([
    listPortalClientOptions(),
    listPortalSessions({ provider: "DISPUTEFOX", take: 20 }),
    prisma.disputeRound.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { client: { select: { grantsClientId: true, firstName: true, lastName: true } } },
    }),
  ]);

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">DisputeFox</p>
      <h1 className="text-4xl mb-2">Dispute workspace</h1>
      <p className="gc-section-sub mb-6">{entry.description}</p>
      <CreditSubnav current="/credit/disputefox" />

      {hasPermission(user.role, "MANAGE_CREDIT") ? (
        <PortalWorkspace
          provider="DISPUTEFOX"
          officialUrl={entry.officialUrl}
          iframeAllowed={entry.iframeAllowed}
          clients={clients}
        />
      ) : null}

      <section className="mt-10">
        <h2 className="text-2xl mb-4">Rounds on file</h2>
        <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
          {rounds.length === 0 ? (
            <p className="py-5 text-sm text-[var(--gc-muted)]">No dispute rounds tracked yet.</p>
          ) : (
            rounds.map((r) => (
              <div key={r.id} className="py-3 flex justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {r.client.firstName} {r.client.lastName}
                  </p>
                  <p className="text-sm text-[var(--gc-muted)]">
                    {r.client.grantsClientId} · Round {r.roundNumber}
                  </p>
                </div>
                <span className="gc-status">{r.status.replaceAll("_", " ")}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl mb-4">Portal visits</h2>
        <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
          {sessions.length === 0 ? (
            <p className="py-5 text-sm text-[var(--gc-muted)]">No recorded visits.</p>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="py-3 text-sm">
                <p className="font-medium">
                  {s.client
                    ? `${s.client.grantsClientId} · ${s.client.firstName} ${s.client.lastName}`
                    : "Unassigned"}
                </p>
                <p className="text-[var(--gc-muted)]">
                  {s.resultStatus} · {s.openedBy.firstName} · {s.openedAt.toLocaleString()}
                  {s.externalRef ? ` · ${s.externalRef}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
