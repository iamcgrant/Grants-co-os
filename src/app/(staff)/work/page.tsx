import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import {
  clientSourceLabel,
  getJonaProcessingBoard,
  getOwnerCommandCenter,
  getSimonCareBoard,
} from "@/lib/ops/command-center";
import { Role } from "@/generated/prisma/client";

function QueueClientRow({
  c,
}: {
  c: {
    id: string;
    grantsClientId: string;
    firstName: string;
    lastName: string;
    nextAction: string | null;
    stage: string;
    identifiers: { provider: string; metadataJson: string | null }[];
  };
}) {
  return (
    <Link href={`/clients/${c.grantsClientId}`} className="py-3 flex justify-between gap-3">
      <div>
        <p className="font-medium">
          {c.firstName} {c.lastName}
        </p>
        <p className="text-sm text-[var(--gc-muted)]">
          {c.grantsClientId} · {clientSourceLabel(c.identifiers)} · {c.nextAction || "Open Client 360"}
        </p>
      </div>
      <span className="gc-status">{c.stage.replaceAll("_", " ")}</span>
    </Link>
  );
}
export default async function WorkPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "MANAGE_OPERATIONS")) {
    return <p className="text-[var(--gc-muted)]">Operations access is not enabled for this role.</p>;
  }

  const { view } = await searchParams;

  if (user.role === Role.CUSTOMER_SERVICE || view === "simon") {
    const simon =
      user.role === Role.CUSTOMER_SERVICE
        ? user
        : await prisma.user.findFirst({ where: { role: Role.CUSTOMER_SERVICE } });
    if (!simon) return <p>Simon workspace not configured.</p>;
    const board = await getSimonCareBoard(simon.id);
    return (
      <div className="gc-fade-up">
        <p className="gc-eyebrow mb-2">Operations</p>
        <h1 className="text-4xl mb-2">Client Care board</h1>
        <p className="gc-section-sub">Simon’s queues — follow-up, readiness, and handoff to processing.</p>
        {(
          [
            ["Needs follow-up", board.buckets.needsFollowUp],
            ["Results to deliver", board.buckets.resultsToDeliver],
            ["Ready for Jona", board.buckets.readyForJona],
            ["Overdue", board.buckets.overdue],
          ] as const
        ).map(([title, list]) => (
          <section key={title} className="mb-8">
            <h2 className="text-xl mb-3">
              {title} <span className="text-[var(--gc-muted)] text-base">({list.length})</span>
            </h2>
            <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
              {list.length === 0 && <p className="py-4 text-sm text-[var(--gc-muted)]">Clear.</p>}
              {list.map((c) => (
                <QueueClientRow key={c.id} c={c} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (user.role === Role.FILE_PREPARER || view === "jona") {
    const jona =
      user.role === Role.FILE_PREPARER
        ? user
        : await prisma.user.findFirst({ where: { role: Role.FILE_PREPARER } });
    if (!jona) return <p>Jona workspace not configured.</p>;
    const board = await getJonaProcessingBoard(jona.id);
    return (
      <div className="gc-fade-up">
        <p className="gc-eyebrow mb-2">Operations</p>
        <h1 className="text-4xl mb-2">Processing board</h1>
        <p className="gc-section-sub">Jona’s queues — rounds, filings, results, and returns to Client Care.</p>
        {Object.entries(board.queues).map(([key, list]) => (
          <section key={key} className="mb-8">
            <h2 className="text-xl mb-3 capitalize">
              {key.replace(/([A-Z])/g, " $1")} <span className="text-[var(--gc-muted)] text-base">({list.length})</span>
            </h2>
            <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
              {list.length === 0 && <p className="py-4 text-sm text-[var(--gc-muted)]">Clear.</p>}
              {list.map((c) => (
                <QueueClientRow key={c.id} c={c} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const owner = await getOwnerCommandCenter();
  const overdue = await prisma.task.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
      dueAt: { lt: new Date() },
    },
    include: {
      client: { select: { grantsClientId: true, firstName: true, lastName: true } },
      assignee: { select: { firstName: true, lastName: true } },
    },
    orderBy: { dueAt: "asc" },
    take: 30,
  });

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">Operations command</p>
      <h1 className="text-4xl mb-2">Work</h1>
      <p className="gc-section-sub">Today’s operating board across Simon, Jona, and owner review.</p>
      <div className="flex flex-wrap gap-2 mb-8">
        <Link href="/work?view=simon" className="gc-btn gc-btn-outline">
          Simon
        </Link>
        <Link href="/work?view=jona" className="gc-btn gc-btn-outline">
          Jona
        </Link>
        <Link href="/work?view=overdue" className="gc-btn gc-btn-ice">
          Overdue ({owner.team.overdueTasks})
        </Link>
      </div>
      <div className="divide-y divide-[var(--gc-border)]">
        {overdue.map((t) => (
          <div key={t.id} className="py-4 flex justify-between gap-4">
            <div>
              <p className="font-medium">{t.title}</p>
              <p className="text-sm text-[var(--gc-muted)]">
                {t.client ? `${t.client.firstName} ${t.client.lastName} · ${t.client.grantsClientId}` : "No client"}
                {t.assignee ? ` · ${t.assignee.firstName}` : ""}
              </p>
            </div>
            {t.client && (
              <Link href={`/clients/${t.client.grantsClientId}`} className="gc-btn gc-btn-ghost text-xs">
                Open
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
