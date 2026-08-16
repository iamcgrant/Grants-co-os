import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function PortalCreditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const client = await prisma.client.findFirst({
    where: { userId: user.id },
    include: {
      creditScores: { orderBy: { capturedAt: "asc" } },
    },
  });
  if (!client) return <p>No profile</p>;

  const byKey = new Map<string, typeof client.creditScores>();
  for (const s of client.creditScores) {
    const key = `${s.bureau}|${s.scoringModel}`;
    const arr = byKey.get(key) || [];
    arr.push(s);
    byKey.set(key, arr);
  }

  return (
    <div className="gc-fade-up space-y-8">
      <div>
        <h1 className="text-4xl mb-2">My Credit</h1>
        <p className="text-sm text-[var(--gc-muted)]">
          Scores keep their bureau, model, and source.
        </p>
      </div>

      {[...byKey.entries()].map(([key, scores]) => {
        const [bureau, model] = key.split("|");
        const start = scores[0];
        const current = scores[scores.length - 1];
        const change = current.score - start.score;
        return (
          <section key={key} className="border-b border-[var(--gc-border)] pb-6">
            <p className="text-[0.65rem] tracking-[0.18em] uppercase text-[var(--gc-muted)]">
              {bureau}
            </p>
            <p className="display text-5xl my-1">{current.score}</p>
            <p className="text-sm text-[var(--gc-muted)]">
              {model} · via {current.source}
            </p>
            <p className="text-sm mt-2">
              Starting {start.score} · Change{" "}
              <span className={change >= 0 ? "text-[var(--gc-success)]" : "text-[var(--gc-danger)]"}>
                {change >= 0 ? "+" : ""}
                {change}
              </span>
            </p>
            <div className="mt-4 flex items-end gap-1 h-16">
              {scores.map((s) => (
                <div
                  key={s.id}
                  className="flex-1 bg-[var(--gc-gold)] opacity-80 rounded-sm"
                  style={{ height: `${Math.max(8, ((s.score - 500) / 350) * 100)}%` }}
                  title={`${s.score}`}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
