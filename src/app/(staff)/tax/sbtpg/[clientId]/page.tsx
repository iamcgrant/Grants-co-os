import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { requireTaxStaff } from "@/lib/tax/access";
import { taxDeskCatalog, taxStatusLabel, type TaxDeskStatus } from "@/lib/tax/catalog";
import { TaxDeskAttachForm } from "@/components/tax/TaxDeskAttachForm";
import { TaxDeskSessionForm } from "@/components/tax/TaxDeskSessionForm";
import { formatUsd } from "@/lib/payments/dashboard";

export default async function SbtpgClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { user, denied } = await requireTaxStaff();
  if (denied || !user) return <p>Access denied.</p>;

  const { clientId } = await params;
  const client = await prisma.client.findFirst({
    where: { OR: [{ grantsClientId: clientId }, { id: clientId }] },
    include: {
      identifiers: { where: { provider: "SBTPG" }, orderBy: { updatedAt: "desc" }, take: 1 },
      timelineEvents: {
        where: { eventType: { in: ["SBTPG_SESSION", "SBTPG_ATTACHED"] } },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
    },
  });
  if (!client) notFound();

  const catalog = taxDeskCatalog("SBTPG");
  const canManage = hasPermission(user.role, "MANAGE_OPERATIONS");
  const deskId = client.identifiers[0]?.externalId || null;
  let status: string | null = null;
  let nextAction: string | null = null;
  let amountCents: number | null = null;
  try {
    const meta = client.identifiers[0]?.metadataJson
      ? (JSON.parse(client.identifiers[0].metadataJson) as Record<string, unknown>)
      : {};
    if (typeof meta.status === "string") status = meta.status;
    if (typeof meta.nextAction === "string") nextAction = meta.nextAction;
    if (typeof meta.amountCents === "number") amountCents = meta.amountCents;
  } catch {
    /* ignore */
  }

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">{catalog.eyebrow}</p>
      <h1 className="text-4xl md:text-5xl mb-2">
        {client.firstName} {client.lastName}
      </h1>
      <p className="gc-section-sub mb-2">
        {client.grantsClientId} · SBTPG {deskId || "not attached"} · {client.stage.replaceAll("_", " ")}
      </p>
      <p className="mb-8">
        <Link href="/tax/sbtpg" className="text-sm text-[var(--gc-ice)]">
          SBTPG workspace
        </Link>
        {" · "}
        <Link href={`/clients/${client.grantsClientId}`} className="text-sm text-[var(--gc-ice)]">
          Client 360
        </Link>
      </p>

      <div className="gc-grid-dense gc-grid-dense-3 mb-10">
        <div className="gc-card">
          <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">Payout</p>
          <p className="display text-2xl">{deskId || "Not attached"}</p>
        </div>
        <div className="gc-card">
          <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">Status</p>
          <p className="display text-2xl">{status ? taxStatusLabel(status as TaxDeskStatus) : "—"}</p>
        </div>
        <div className="gc-card">
          <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">Amount</p>
          <p className="display text-2xl">{amountCents != null ? formatUsd(amountCents) : nextAction || "—"}</p>
        </div>
      </div>

      {canManage ? (
        <div className="mb-10 grid gap-6 lg:grid-cols-2">
          <TaxDeskAttachForm
            desk="SBTPG"
            clients={[
              {
                id: client.id,
                grantsClientId: client.grantsClientId,
                firstName: client.firstName,
                lastName: client.lastName,
              },
            ]}
            lockedClientId={client.id}
          />
          <TaxDeskSessionForm
            desk="SBTPG"
            clients={[
              {
                id: client.id,
                grantsClientId: client.grantsClientId,
                firstName: client.firstName,
                lastName: client.lastName,
              },
            ]}
            lockedClientId={client.id}
          />
        </div>
      ) : null}

      <section>
        <h2 className="text-2xl mb-3">Recorded payout sessions</h2>
        <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
          {client.timelineEvents.length === 0 ? (
            <p className="py-4 text-sm text-[var(--gc-muted)]">No SBTPG sessions recorded yet.</p>
          ) : (
            client.timelineEvents.map((event) => (
              <div key={event.id} className="py-4">
                <p className="font-medium">{event.title}</p>
                {event.description ? <p className="text-sm text-[var(--gc-muted)]">{event.description}</p> : null}
                <p className="text-[0.65rem] tracking-[0.12em] uppercase text-[var(--gc-muted)] mt-1">
                  {event.createdAt.toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
