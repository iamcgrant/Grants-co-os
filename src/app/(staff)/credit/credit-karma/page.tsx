import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { CreditSubnav } from "@/components/credit/CreditSubnav";
import { AssistedKarmaForm } from "@/components/credit/AssistedKarmaForm";
import { PortalWorkspace } from "@/components/portals/PortalWorkspace";
import { getPortalEntry } from "@/lib/portals/catalog";
import { listPortalClientOptions } from "@/lib/portals/clients";

export default async function CreditKarmaWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_CREDIT_DOCS")) return <p>Access denied.</p>;

  const entry = getPortalEntry("CREDIT_KARMA");
  const clients = await listPortalClientOptions();

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">Credit Karma</p>
      <h1 className="text-4xl mb-2">Client-assisted only</h1>
      <p className="gc-section-sub mb-6">{entry.description}</p>
      <CreditSubnav current="/credit/credit-karma" />
      {hasPermission(user.role, "MANAGE_CREDIT") ? (
        <>
          <AssistedKarmaForm clients={clients} />
          <div className="mt-8">
            <p className="text-sm text-[var(--gc-muted)] mb-3">
              If the client is with you, open Credit Karma on <em>their</em> device via the official site.
              Do not use a staff login and do not scrape.
            </p>
            <PortalWorkspace
              provider="CREDIT_KARMA"
              officialUrl={entry.officialUrl}
              iframeAllowed={false}
              clients={clients}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
