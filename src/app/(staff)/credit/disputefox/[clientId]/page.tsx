import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { requireCreditStaff } from "@/lib/disputes/access";
import { createCase, getOpenCaseForClient } from "@/lib/disputes/cases";
import { channelCatalog } from "@/lib/disputes/channels";
import { CaseWorkspace } from "@/components/disputes/CaseWorkspace";

export default async function DisputeFoxClientWorkspacePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { user, denied } = await requireCreditStaff();
  if (denied || !user) return <p>Access denied.</p>;

  const { clientId } = await params;
  if (clientId === "case") notFound();

  const client = await prisma.client.findFirst({
    where: { OR: [{ grantsClientId: clientId }, { id: clientId }] },
    include: {
      identifiers: { where: { provider: "DISPUTEFOX" }, take: 1 },
      disputeRounds: { orderBy: { roundNumber: "desc" }, take: 3 },
    },
  });
  if (!client) notFound();

  const catalog = channelCatalog("DISPUTEFOX");
  const canManage = hasPermission(user.role, "MANAGE_CREDIT");
  const existing = await getOpenCaseForClient(client.id, "DISPUTEFOX");
  const disputeCase =
    existing ??
    (canManage
      ? await createCase({
          clientId: client.id,
          channel: "DISPUTEFOX",
          actorId: user.id,
        })
      : null);

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">{catalog.eyebrow}</p>
      <h1 className="text-4xl md:text-5xl mb-2">
        {client.firstName} {client.lastName}
      </h1>
      <p className="gc-section-sub mb-2">
        {client.grantsClientId} · DisputeFox {client.identifiers[0]?.externalId || "not attached"} · {client.stage.replaceAll("_", " ")}
      </p>
      <p className="mb-8">
        <Link href="/credit/disputefox" className="text-sm text-[var(--gc-ice)]">
          DisputeFox workspace
        </Link>
        {" · "}
        <Link href={`/clients/${client.grantsClientId}?tab=disputes`} className="text-sm text-[var(--gc-ice)]">
          Client 360
        </Link>
      </p>

      {client.disputeRounds.length > 0 ? (
        <section className="mb-10">
          <h2 className="text-2xl mb-3">Letter rounds</h2>
          <div className="gc-grid-dense gc-grid-dense-3">
            {client.disputeRounds.map((round) => (
              <div key={round.id} className="gc-card">
                <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">
                  Round {round.roundNumber}
                </p>
                <p className="display text-2xl">{round.status.replaceAll("_", " ")}</p>
                <p className="text-sm text-[var(--gc-muted)] mt-2">
                  {round.remainingItemsCount} remaining · {round.deletedItemsCount} deleted
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {disputeCase ? (
        <CaseWorkspace disputeCase={disputeCase} canManage={canManage} />
      ) : (
        <p className="text-sm text-[var(--gc-muted)]">No open DisputeFox case for this client.</p>
      )}
    </div>
  );
}
