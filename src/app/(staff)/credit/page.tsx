import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { CreditSubnav } from "@/components/credit/CreditSubnav";
import { getPortalCatalog } from "@/lib/portals/catalog";
import { prisma } from "@/lib/db/prisma";

export default async function CreditHubPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_CREDIT_DOCS")) return <p>Access denied.</p>;

  const catalog = getPortalCatalog();
  const [dfRounds, assisted, portals] = await Promise.all([
    prisma.disputeRound.count(),
    prisma.creditScore.count({ where: { source: "CREDIT_KARMA_ASSISTED" } }),
    prisma.portalWorkspaceSession.count(),
  ]);

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">Credit &amp; Disputes</p>
      <h1 className="text-4xl mb-2">Workspaces</h1>
      <p className="gc-section-sub mb-6">
        DisputeFox, Experian, SmartCredit, Credit Karma, and CFPB escalations. No bureau scraping. No
        second phone provider.
      </p>
      <CreditSubnav current="/credit" />

      <div className="gc-grid-dense gc-grid-dense-3 mb-8">
        <div className="gc-card">
          <p className="gc-eyebrow mb-2">Dispute rounds</p>
          <p className="display text-3xl">{dfRounds}</p>
        </div>
        <div className="gc-card">
          <p className="gc-eyebrow mb-2">CK assisted scores</p>
          <p className="display text-3xl">{assisted}</p>
        </div>
        <div className="gc-card">
          <p className="gc-eyebrow mb-2">Portal visits</p>
          <p className="display text-3xl">{portals}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Object.values(catalog).map((entry) => (
          <Link key={entry.id} href={entry.href} className="gc-card hover:bg-white/[0.06] transition-colors">
            <p className="gc-eyebrow mb-2">{entry.group === "escalations" ? "Escalations" : "Credit"}</p>
            <p className="text-xl display">{entry.label}</p>
            <p className="text-sm text-[var(--gc-muted)] mt-2">{entry.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
