import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  CREDIT_DISPUTES_NAV,
  ESCALATIONS_NAV,
  getCreditDisputesNav,
  getEscalationsNav,
} from "@/lib/nav/role-nav";

export default async function CreditDisputesHubPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "MANAGE_CREDIT") && !hasPermission(user.role, "VIEW_CREDIT_DOCS")) {
    return <p>Access denied.</p>;
  }

  const creditItems = getCreditDisputesNav();
  const escalationItems = getEscalationsNav();

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">{CREDIT_DISPUTES_NAV.hub.label}</p>
      <h1 className="text-4xl md:text-5xl mb-2">Workspaces</h1>
      <p className="gc-section-sub mb-10 max-w-2xl">
        DisputeFox opens existing Client 360 and Jona surfaces. SmartCredit is Friday Pulse.
        Experian, Credit Karma, and CFPB are route shells only — no vendor APIs and no scraping.
      </p>

      <section className="mb-10">
        <h2 className="text-2xl mb-4">{CREDIT_DISPUTES_NAV.hub.label}</h2>
        <div className="gc-grid-dense gc-grid-dense-2">
          {creditItems.map((item) => (
            <Link key={item.href} href={item.href} className="gc-card hover:bg-white/[0.06] transition-colors">
              <p className="text-xl display">{item.label}</p>
              <p className="text-sm text-[var(--gc-muted)] mt-2">{creditHubBlurb(item.href)}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl mb-4">Escalations</h2>
        <div className="gc-grid-dense gc-grid-dense-2">
          {escalationItems.map((item) => (
            <Link key={item.href} href={item.href} className="gc-card hover:bg-white/[0.06] transition-colors">
              <p className="text-xl display">{item.label}</p>
              <p className="text-sm text-[var(--gc-muted)] mt-2">
                {item.label === ESCALATIONS_NAV.cfpb.label
                  ? "CFPB escalation shell. Portal workspace is a later slice. No CFPB API."
                  : item.label}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function creditHubBlurb(href: string): string {
  switch (href) {
    case CREDIT_DISPUTES_NAV.disputeFox.href:
      return "Existing Client 360 Disputes tab and Jona board. Not a new DisputeFox API workspace.";
    case CREDIT_DISPUTES_NAV.experian.href:
      return "Route shell for a later Experian portal workspace. No Experian API.";
    case CREDIT_DISPUTES_NAV.smartCredit.href:
      return "Existing SmartCredit / Friday Pulse workflow.";
    case CREDIT_DISPUTES_NAV.creditKarma.href:
      return "Client-assisted score entry shell. No Credit Karma scrape.";
    default:
      return "Credit & Disputes workspace.";
  }
}
