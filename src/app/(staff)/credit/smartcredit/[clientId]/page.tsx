import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { requireCreditStaff } from "@/lib/disputes/access";
import { createCase, getOpenCaseForClient } from "@/lib/disputes/cases";
import { channelCatalog } from "@/lib/disputes/channels";
import { SMARTCREDIT_PROVIDER } from "@/lib/credit/smartcredit-workspace";
import { CaseWorkspace } from "@/components/disputes/CaseWorkspace";
import { SmartCreditAttachForm } from "@/components/credit/SmartCreditAttachForm";
import { SmartCreditSessionForm } from "@/components/credit/SmartCreditSessionForm";

export default async function SmartCreditClientWorkspacePage({
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
      identifiers: { where: { provider: SMARTCREDIT_PROVIDER }, orderBy: { updatedAt: "desc" }, take: 1 },
      creditConnections: { where: { provider: SMARTCREDIT_PROVIDER }, take: 1 },
      creditScores: { where: { source: "SMARTCREDIT" }, orderBy: { capturedAt: "desc" }, take: 6 },
    },
  });
  if (!client) notFound();

  const catalog = channelCatalog("SMARTCREDIT");
  const canManage = hasPermission(user.role, "MANAGE_CREDIT");
  const existing = await getOpenCaseForClient(client.id, "SMARTCREDIT");
  const disputeCase =
    existing ??
    (canManage
      ? await createCase({
          clientId: client.id,
          channel: "SMARTCREDIT",
          actorId: user.id,
        })
      : null);
  const smartCreditId = client.identifiers[0]?.externalId || client.creditConnections[0]?.externalId || null;
  const connection = client.creditConnections[0] || null;

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">{catalog.eyebrow}</p>
      <h1 className="text-4xl md:text-5xl mb-2">
        {client.firstName} {client.lastName}
      </h1>
      <p className="gc-section-sub mb-2">
        {client.grantsClientId} · SmartCredit {smartCreditId || "not attached"} · {client.stage.replaceAll("_", " ")}
      </p>
      <p className="mb-8">
        <Link href="/credit/smartcredit" className="text-sm text-[var(--gc-ice)]">
          SmartCredit workspace
        </Link>
        {" · "}
        <Link href={`/clients/${client.grantsClientId}?tab=credit`} className="text-sm text-[var(--gc-ice)]">
          Client 360
        </Link>
      </p>

      <div className="gc-grid-dense gc-grid-dense-3 mb-10">
        <div className="gc-card">
          <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">Attachment</p>
          <p className="display text-2xl">{smartCreditId || "Not attached"}</p>
        </div>
        <div className="gc-card">
          <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">Connection</p>
          <p className="display text-2xl">{connection?.status.replaceAll("_", " ") || "None"}</p>
        </div>
        <div className="gc-card">
          <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">Last session</p>
          <p className="display text-2xl">
            {connection?.lastSyncedAt ? connection.lastSyncedAt.toLocaleDateString() : "—"}
          </p>
        </div>
      </div>

      {client.creditScores.length > 0 ? (
        <section className="mb-10">
          <h2 className="text-2xl mb-3">Recorded SmartCredit scores</h2>
          <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
            {client.creditScores.map((score) => (
              <div key={score.id} className="py-3 flex justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {score.bureau} · {score.score}
                  </p>
                  <p className="text-sm text-[var(--gc-muted)]">{score.scoringModel}</p>
                </div>
                <span className="gc-status">{score.capturedAt.toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {canManage ? (
        <div className="mb-10 grid gap-6 lg:grid-cols-2">
          <SmartCreditAttachForm
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
          <SmartCreditSessionForm
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

      {disputeCase ? (
        <CaseWorkspace disputeCase={disputeCase} canManage={canManage} />
      ) : (
        <p className="text-sm text-[var(--gc-muted)]">No open SmartCredit case for this client.</p>
      )}
    </div>
  );
}
