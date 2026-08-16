import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { FridayPulseButton } from "@/components/credit/FridayPulseButton";

export default async function CreditPulsePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "MANAGE_CREDIT")) {
    return <p>Access denied.</p>;
  }

  const clients = await prisma.client.findMany({
    where: { creditConnections: { some: {} } },
    include: {
      creditScores: { orderBy: { capturedAt: "desc" }, take: 9 },
      creditConnections: {
        select: { provider: true, status: true, needsReauth: true, lastSyncedAt: true },
      },
    },
    take: 50,
  });

  return (
    <div>
      <div className="gc-fade-up mb-10">
        <p className="text-[0.7rem] tracking-[0.3em] uppercase text-[var(--gc-champagne-dim)] mb-2">
          Grants Credit Pulse
        </p>
        <h1 className="text-4xl md:text-5xl mb-2">Score Intelligence</h1>
        <p className="text-sm text-[var(--gc-muted)] max-w-xl">
          Bureau, score, scoring model, and source are always stored together. Snapshots are preserved — never overwritten.
        </p>
      </div>

      <div className="space-y-10">
        {clients.map((c) => {
          const latestByBureau = new Map<string, (typeof c.creditScores)[0]>();
          for (const s of c.creditScores) {
            const key = `${s.bureau}:${s.scoringModel}`;
            if (!latestByBureau.has(key)) latestByBureau.set(key, s);
          }
          return (
            <section key={c.id} className="border-b border-[var(--gc-border)] pb-8">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-2xl">
                    {c.firstName} {c.lastName}
                  </h2>
                  <p className="text-xs text-[var(--gc-muted)]">{c.grantsClientId}</p>
                </div>
                <FridayPulseButton clientId={c.id} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[...latestByBureau.values()].map((s) => (
                  <div key={s.id}>
                    <p className="text-[0.65rem] tracking-[0.16em] uppercase text-[var(--gc-muted)]">
                      {s.bureau}
                    </p>
                    <p className="display text-4xl">{s.score}</p>
                    <p className="text-xs text-[var(--gc-muted)]">
                      {s.scoringModel}
                      <br />
                      via {s.source}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--gc-muted)]">
                {c.creditConnections.map((conn) => (
                  <span key={conn.provider}>
                    {conn.provider}: {conn.status}
                    {conn.needsReauth ? " · needs reauth" : ""}
                  </span>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
