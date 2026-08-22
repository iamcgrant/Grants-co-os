import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { ESCALATIONS_NAV } from "@/lib/nav/role-nav";

export default async function CfpbEscalationShellPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "MANAGE_CREDIT") && !hasPermission(user.role, "VIEW_CREDIT_DOCS")) {
    return <p>Access denied.</p>;
  }

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">Escalations</p>
      <h1 className="text-4xl md:text-5xl mb-2">{ESCALATIONS_NAV.cfpb.label}</h1>
      <p className="gc-section-sub mb-8 max-w-2xl">
        Route shell only. The CFPB portal workspace (complaint id, opened-at, outcome) is a later
        slice.
      </p>
      <div className="gc-card max-w-2xl">
        <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">
          Placeholder
        </p>
        <p className="text-sm text-[var(--gc-muted)] leading-relaxed">
          No CFPB API and no scrape in this slice. Escalations stay a navigation destination until
          the portal workspace PR.
        </p>
      </div>
    </div>
  );
}
