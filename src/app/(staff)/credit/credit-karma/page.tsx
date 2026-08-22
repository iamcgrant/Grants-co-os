import { prisma } from "@/lib/db/prisma";
import { CREDIT_DISPUTES_NAV } from "@/lib/nav/role-nav";
import { requireCreditStaff } from "@/lib/disputes/access";
import { ClientAssistedScoreForm } from "@/components/credit/ClientAssistedScoreForm";
import { DeskEmptyState } from "@/components/desk/DeskEmptyState";
import { hasPermission } from "@/lib/rbac/permissions";

export default async function CreditKarmaAssistedPage() {
  const { user, denied } = await requireCreditStaff();
  if (denied || !user) return <p>Access denied.</p>;

  const clients = await prisma.client.findMany({
    orderBy: { lastName: "asc" },
    take: 200,
    select: { id: true, grantsClientId: true, firstName: true, lastName: true },
  });

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">Credit &amp; Disputes</p>
      <h1 className="text-4xl md:text-5xl mb-2">{CREDIT_DISPUTES_NAV.creditKarma.label}</h1>
      <p className="gc-section-sub mb-8 max-w-2xl">
        Client-assisted score entry. Staff record what the client reports from their Credit Karma
        account. No scraping, applications, offers, disputes, or settings changes.
      </p>
      {clients.length === 0 ? (
        <DeskEmptyState
          detail="No Grants clients to attach a client-assisted Credit Karma score to. This desk does not scrape Credit Karma."
          nextAction="Add or pull a Grants client, then record the score the client reports."
        />
      ) : null}
      {hasPermission(user.role, "MANAGE_CREDIT") ? (
        <ClientAssistedScoreForm clients={clients} />
      ) : (
        <p className="text-sm text-[var(--gc-muted)]">View only — Client Care/processing can record assisted scores.</p>
      )}
    </div>
  );
}
