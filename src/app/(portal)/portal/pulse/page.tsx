import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function PortalCreditPulsePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const client = await prisma.client.findFirst({
    where: { userId: user.id },
    include: {
      creditScores: { orderBy: { capturedAt: "desc" }, take: 12 },
      fridayPulseItems: { orderBy: { createdAt: "desc" }, take: 5, include: { run: true } },
      onboardingChecklist: true,
      tasks: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, take: 10 },
    },
  });

  if (!client) return <p>No client profile linked.</p>;

  const byBureau = new Map<string, typeof client.creditScores>();
  for (const s of client.creditScores) {
    const list = byBureau.get(s.bureau) || [];
    list.push(s);
    byBureau.set(s.bureau, list);
  }

  return (
    <div className="gc-fade-up space-y-10">
      <div>
        <p className="text-[0.7rem] tracking-[0.28em] uppercase text-[var(--gc-gold)] mb-2">
          Grants &amp; Co
        </p>
        <h1 className="text-4xl mb-2">Friday Credit Pulse</h1>
        <p className="text-sm text-[var(--gc-muted)]">
          Your progress is saved inside your Grants &amp; Co file. Incompatible score models are never
          compared as identical.
        </p>
      </div>

      <section className="grid gap-4">
        {["EQUIFAX", "EXPERIAN", "TRANSUNION"].map((bureau) => {
          const scores = byBureau.get(bureau) || [];
          const current = scores[0];
          const previous = scores[1];
          const change =
            current && previous && current.scoringModel === previous.scoringModel
              ? current.score - previous.score
              : null;
          return (
            <div key={bureau} className="border-b border-[var(--gc-border)] pb-4">
              <p className="text-[0.65rem] tracking-[0.16em] uppercase text-[var(--gc-muted)]">
                {bureau}
              </p>
              {current ? (
                <>
                  <p className="display text-4xl text-[var(--gc-gold)]">{current.score}</p>
                  <p className="text-xs text-[var(--gc-muted)] mt-1">
                    Model {current.scoringModel}
                    {change === null
                      ? " · prior comparable reading DATA UNAVAILABLE"
                      : change === 0
                        ? " · no change this period"
                        : ` · ${change > 0 ? "+" : ""}${change} vs prior`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--gc-muted)] mt-2">DATA UNAVAILABLE</p>
              )}
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="text-2xl mb-3">Requested from you</h2>
        {client.tasks.length === 0 ? (
          <p className="text-sm text-[var(--gc-muted)]">No open requests.</p>
        ) : (
          <ul className="space-y-2">
            {client.tasks.map((t) => (
              <li key={t.id} className="text-sm">
                {t.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-2xl mb-3">Onboarding</h2>
        <div className="space-y-2">
          {client.onboardingChecklist.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.label}</span>
              <span className="text-[var(--gc-muted)]">{item.status}</span>
            </div>
          ))}
        </div>
      </section>

      <Link href="/portal" className="gc-btn gc-btn-ghost inline-flex">
        Back to portal
      </Link>
    </div>
  );
}
