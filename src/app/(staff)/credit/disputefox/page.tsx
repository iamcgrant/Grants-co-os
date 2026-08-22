import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { CREDIT_DISPUTES_NAV } from "@/lib/nav/role-nav";

export default async function DisputeFoxNavPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "MANAGE_CREDIT") && !hasPermission(user.role, "VIEW_CREDIT_DOCS")) {
    return <p>Access denied.</p>;
  }

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">Credit &amp; Disputes</p>
      <h1 className="text-4xl md:text-5xl mb-2">{CREDIT_DISPUTES_NAV.disputeFox.label}</h1>
      <p className="gc-section-sub mb-10 max-w-2xl">
        Use the existing Client 360 Disputes tab and Jona processing board. This page does not
        create a DisputeFox API workspace, invent DF IDs, or write to DisputeFox. Zap 374413762
        stays OFF.
      </p>

      <div className="gc-grid-dense gc-grid-dense-2">
        <Link href="/clients" className="gc-card hover:bg-white/[0.06] transition-colors">
          <p className="gc-eyebrow mb-2">Client 360</p>
          <p className="text-xl display">Clients</p>
          <p className="text-sm text-[var(--gc-muted)] mt-2">
            Open a master client and use the Disputes tab for local rounds and the existing
            DisputeFox new-tab link.
          </p>
        </Link>
        {hasPermission(user.role, "MANAGE_OPERATIONS") ? (
          <Link href="/work?view=jona" className="gc-card hover:bg-white/[0.06] transition-colors">
            <p className="gc-eyebrow mb-2">Jona</p>
            <p className="text-xl display">Processing board</p>
            <p className="text-sm text-[var(--gc-muted)] mt-2">
              Existing file-preparer queues. Not a replacement DisputeFox product.
            </p>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
