import Link from "next/link";
import { TAX_NAV, getTaxNav } from "@/lib/nav/role-nav";
import { requireTaxStaff } from "@/lib/tax/access";
import { TAX_DESK_CATALOG } from "@/lib/tax/catalog";

export default async function TaxHubPage() {
  const { user, denied } = await requireTaxStaff();
  if (denied || !user) return <p>Access denied.</p>;

  const items = getTaxNav();

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">{TAX_NAV.hub.label}</p>
      <h1 className="text-4xl md:text-5xl mb-2">Workspaces</h1>
      <p className="gc-section-sub mb-10 max-w-2xl">
        Native Grants OS tax desks. Official Cloud Tax Office and SBTPG portals are last-step only. Cognito
        uses the official Forms API. No scraping.
      </p>

      <section>
        <h2 className="text-2xl mb-4">Tax</h2>
        <div className="gc-grid-dense gc-grid-dense-2">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="gc-card hover:bg-white/[0.06] transition-colors">
              <p className="text-xl display">{item.label}</p>
              <p className="text-sm text-[var(--gc-muted)] mt-2">{taxHubBlurb(item.href)}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function taxHubBlurb(href: string): string {
  switch (href) {
    case TAX_NAV.cloudTaxOffice.href:
      return TAX_DESK_CATALOG.CLOUD_TAX_OFFICE.honesty;
    case TAX_NAV.sbtpg.href:
      return TAX_DESK_CATALOG.SBTPG.honesty;
    case TAX_NAV.cognito.href:
      return "Official Cognito Forms API lists submitted tax/client forms in OS. COGNITO_API_KEY required. No scrape.";
    default:
      return "Tax workspace.";
  }
}
