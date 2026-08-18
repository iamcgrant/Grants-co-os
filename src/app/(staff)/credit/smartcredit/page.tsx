import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { CreditSubnav } from "@/components/credit/CreditSubnav";
import { SmartCreditEnrollButton } from "@/components/credit/SmartCreditEnrollButton";
import { PortalWorkspace } from "@/components/portals/PortalWorkspace";
import { getPortalEntry } from "@/lib/portals/catalog";
import { listPortalClientOptions } from "@/lib/portals/clients";
import { getSmartCreditSponsorConfig } from "@/lib/credit/smartcredit-sponsor";

export default async function SmartCreditWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_CREDIT_DOCS")) return <p>Access denied.</p>;

  const entry = getPortalEntry("SMARTCREDIT");
  const sponsor = getSmartCreditSponsorConfig();
  const clients = await listPortalClientOptions();

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">SmartCredit</p>
      <h1 className="text-4xl mb-2">Sponsored enrollment</h1>
      <p className="gc-section-sub mb-6">{entry.description}</p>
      <CreditSubnav current="/credit/smartcredit" />
      <p className="text-sm text-[var(--gc-muted)] mb-6">
        Sponsor URL {sponsor.sponsorUrl || sponsor.sponsorCode ? "configured" : "not set — affiliate pid will be missing"}
      </p>
      {hasPermission(user.role, "MANAGE_CREDIT") ? (
        <>
          <SmartCreditEnrollButton clients={clients} />
          <div className="mt-8">
            <PortalWorkspace
              provider="SMARTCREDIT"
              officialUrl={entry.officialUrl}
              iframeAllowed={entry.iframeAllowed}
              clients={clients}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
