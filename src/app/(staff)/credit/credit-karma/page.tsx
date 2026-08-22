import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { CREDIT_DISPUTES_NAV } from "@/lib/nav/role-nav";

export default async function CreditKarmaNavShellPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "MANAGE_CREDIT") && !hasPermission(user.role, "VIEW_CREDIT_DOCS")) {
    return <p>Access denied.</p>;
  }

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">Credit &amp; Disputes</p>
      <h1 className="text-4xl md:text-5xl mb-2">{CREDIT_DISPUTES_NAV.creditKarma.label}</h1>
      <p className="gc-section-sub mb-8 max-w-2xl">
        Client-assisted score entry shell. Staff record what the client reports. Credit Karma
        stays read-only — no scraping, applications, offers, disputes, or settings changes.
      </p>

      <form className="gc-card max-w-xl space-y-4" aria-label="Client-assisted Credit Karma score entry">
        <fieldset disabled className="space-y-4">
          <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)]">
            UI shell — persistence is a later slice
          </p>
          <label className="block">
            <span className="text-xs text-[var(--gc-muted)]">Grants Client</span>
            <input className="gc-search mt-1 w-full" placeholder="Search client…" />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--gc-muted)]">Bureau</span>
            <input className="gc-search mt-1 w-full" defaultValue="Credit Karma (client-assisted)" />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--gc-muted)]">Score</span>
            <input className="gc-search mt-1 w-full" inputMode="numeric" placeholder="000" />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--gc-muted)]">Scoring model</span>
            <input className="gc-search mt-1 w-full" placeholder="As reported by the client" />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--gc-muted)]">Source</span>
            <input className="gc-search mt-1 w-full" defaultValue="CLIENT_ASSISTED" />
          </label>
          <button type="button" className="gc-btn gc-btn-outline text-xs" disabled>
            Save score (later slice)
          </button>
        </fieldset>
      </form>
    </div>
  );
}
