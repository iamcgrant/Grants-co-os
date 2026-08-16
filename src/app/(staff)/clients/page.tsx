import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { CreateClientForm } from "@/components/clients/CreateClientForm";
import { GhlSyncPanel } from "@/components/integrations/GhlSyncPanel";
import { GhlConversationPullPanel } from "@/components/integrations/GhlConversationPullPanel";
import { getGcEnvironment } from "@/lib/integrations/env";
import { isGhlApiReady } from "@/lib/integrations/ghl/http";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_CLIENT")) {
    return <p>Access denied.</p>;
  }

  const { q } = await searchParams;
  const query = q?.trim();

  const clients = await prisma.client.findMany({
    where: query
      ? {
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { email: { contains: query } },
            { grantsClientId: { contains: query.toUpperCase() } },
            { phone: { contains: query } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      grantsClientId: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      stage: true,
      nextAction: true,
      urgency: true,
      nextActionOwner: true,
      identifiers: { select: { provider: true, metadataJson: true } },
    },
  });

  const dataPlane = getGcEnvironment();
  const ghlReady = isGhlApiReady();

  return (
    <div>
      <div className="gc-fade-up mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <p className="gc-eyebrow mb-2">Master identity</p>
          <h1 className="text-3xl md:text-4xl mb-2">Clients</h1>
          <p className="text-sm text-[var(--gc-muted)]">
            One human. One Grants Client ID. {query ? `Results for “${query}”` : "Open Client 360 for the full dossier."}
            {" · "}
            {dataPlane} data plane
            {" · "}
            GHL {ghlReady ? "API ready" : "Awaiting Integration"}
          </p>
        </div>
        <p className="text-sm text-[var(--gc-muted)]">{clients.length} shown</p>
      </div>

      {hasPermission(user.role, "MANAGE_OPERATIONS") && (
        <div className="mb-8 gc-fade-up space-y-4">
          <GhlSyncPanel canSync />
          <GhlConversationPullPanel canSync />
        </div>
      )}

      {hasPermission(user.role, "CREATE_CLIENT") && (
        <div className="mb-8 gc-fade-up-delay">
          <CreateClientForm />
        </div>
      )}

      <div className="gc-panel overflow-hidden gc-fade-up-delay-2">
        <table className="gc-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Stage</th>
              <th>Source</th>
              <th>Next action</th>
              <th>Owner</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const ghl = c.identifiers.find((i) => i.provider === "GHL");
              const live =
                ghl?.metadataJson?.includes('"source":"ghl_api"') ?? false;
              return (
              <tr key={c.id}>
                <td>
                  <Link href={`/clients/${c.grantsClientId}`} className="font-medium hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                  <p className="text-[0.65rem] text-[var(--gc-muted)]">{c.grantsClientId}</p>
                </td>
                <td>
                  <span className="gc-status gc-status-ice">{c.stage.replaceAll("_", " ")}</span>
                </td>
                <td>
                  <span className="gc-status">
                    {live ? "GHL live" : ghl ? "Dev sample" : "Grants"}
                  </span>
                </td>
                <td className="text-sm text-[var(--gc-muted)] max-w-[240px] truncate">{c.nextAction || "—"}</td>
                <td className="text-sm">{c.nextActionOwner || "—"}</td>
                <td>
                  <Link href={`/clients/${c.grantsClientId}`} className="gc-btn gc-btn-ghost text-xs">
                    360
                  </Link>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {clients.length === 0 && (
          <p className="p-6 text-sm text-[var(--gc-muted)]">No clients yet.</p>
        )}
      </div>
    </div>
  );
}
