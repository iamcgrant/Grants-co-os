import Link from "next/link";
import {
  CREDIT_DISPUTES_NAV,
  ESCALATIONS_NAV,
  getCreditDisputesNav,
  getEscalationsNav,
} from "@/lib/nav/role-nav";
import { requireCreditStaff } from "@/lib/disputes/access";
import { DISPUTE_CHANNELS } from "@/lib/disputes/channels";

export default async function CreditDisputesHubPage() {
  const { user, denied } = await requireCreditStaff();
  if (denied || !user) return <p>Access denied.</p>;

  const creditItems = getCreditDisputesNav();
  const escalationItems = getEscalationsNav();

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">{CREDIT_DISPUTES_NAV.hub.label}</p>
      <h1 className="text-4xl md:text-5xl mb-2">Workspaces</h1>
      <p className="gc-section-sub mb-10 max-w-2xl">
        Native Grants OS case files. Official portals are a last submit step only. Credit Karma stays
        client-assisted. No scraping.
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
                  ? DISPUTE_CHANNELS.CFPB.honesty
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
      return DISPUTE_CHANNELS.DISPUTEFOX.honesty;
    case CREDIT_DISPUTES_NAV.experian.href:
      return DISPUTE_CHANNELS.EXPERIAN.honesty;
    case CREDIT_DISPUTES_NAV.equifax.href:
      return DISPUTE_CHANNELS.EQUIFAX.honesty;
    case CREDIT_DISPUTES_NAV.transunion.href:
      return DISPUTE_CHANNELS.TRANSUNION.honesty;
    case CREDIT_DISPUTES_NAV.innovis.href:
      return DISPUTE_CHANNELS.INNOVIS.honesty;
    case CREDIT_DISPUTES_NAV.smartCredit.href:
      return DISPUTE_CHANNELS.SMARTCREDIT.honesty;
    case CREDIT_DISPUTES_NAV.creditKarma.href:
      return "Client-assisted score entry. No Credit Karma scrape.";
    default:
      return "Credit & Disputes workspace.";
  }
}
