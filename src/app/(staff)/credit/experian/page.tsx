import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { CreditSubnav } from "@/components/credit/CreditSubnav";
import { PortalWorkspace } from "@/components/portals/PortalWorkspace";
import { getPortalEntry } from "@/lib/portals/catalog";
import { listPortalClientOptions } from "@/lib/portals/clients";
import { listPortalSessions } from "@/lib/portals/service";

export default async function ExperianWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_CREDIT_DOCS")) return <p>Access denied.</p>;

  const entry = getPortalEntry("EXPERIAN");
  const [clients, sessions] = await Promise.all([
    listPortalClientOptions(),
    listPortalSessions({ provider: "EXPERIAN", take: 20 }),
  ]);

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">Experian</p>
      <h1 className="text-4xl mb-2">Portal workspace</h1>
      <p className="gc-section-sub mb-6">{entry.description}</p>
      <CreditSubnav current="/credit/experian" />
      {hasPermission(user.role, "MANAGE_CREDIT") ? (
        <PortalWorkspace
          provider="EXPERIAN"
          officialUrl={entry.officialUrl}
          iframeAllowed={entry.iframeAllowed}
          clients={clients}
        />
      ) : null}
      <section className="mt-10">
        <h2 className="text-2xl mb-4">Recorded results</h2>
        <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
          {sessions.length === 0 ? (
            <p className="py-5 text-sm text-[var(--gc-muted)]">No Experian portal results yet.</p>
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
