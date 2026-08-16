import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatUsd } from "@/lib/payments/dashboard";

export default async function PortalHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const client = await prisma.client.findFirst({
    where: { userId: user.id },
    include: {
      invoices: { where: { status: { in: ["DUE", "FAILED"] } }, take: 3 },
      creditScores: { orderBy: { capturedAt: "desc" }, take: 3 },
      notifications: { orderBy: { createdAt: "desc" }, take: 5 },
      clientServices: { include: { service: true, milestones: true } },
    },
  });

  if (!client) {
    return <p>No client profile linked.</p>;
  }

  const nextMilestone = client.clientServices
    .flatMap((s) => s.milestones)
    .find((m) => !m.isCompleted);

  return (
    <div className="gc-fade-up space-y-10">
      <div>
        <h1 className="text-4xl mb-2">Your Journey</h1>
        <p className="text-sm text-[var(--gc-muted)]">{client.grantsClientId}</p>
      </div>

      <section>
        <p className="text-[0.65rem] tracking-[0.2em] uppercase text-[var(--gc-muted)] mb-2">
          Next Action
        </p>
        <p className="text-xl">
          {client.invoices[0]
            ? `Pay invoice ${client.invoices[0].invoiceNumber}`
            : nextMilestone
              ? `Awaiting: ${nextMilestone.name}`
              : "You're all caught up"}
        </p>
        {client.invoices[0] && (
          <Link
            href={`/pay/${client.invoices[0].invoiceNumber}`}
            className="gc-btn gc-btn-gold mt-4 inline-flex"
          >
            Pay Securely
          </Link>
        )}
      </section>

      <section>
        <h2 className="text-2xl mb-3">Credit Progress</h2>
        <div className="grid grid-cols-3 gap-3">
          {client.creditScores.slice(0, 3).map((s) => (
            <div key={s.id}>
              <p className="text-[0.6rem] tracking-[0.12em] uppercase text-[var(--gc-muted)]">
                {s.bureau.slice(0, 2)}
              </p>
              <p className="display text-3xl">{s.score}</p>
            </div>
          ))}
        </div>
        <Link href="/portal/credit" className="text-[0.7rem] tracking-[0.14em] uppercase text-[var(--gc-champagne-dim)] mt-3 inline-block">
          View My Credit
        </Link>
      </section>

      <section>
        <h2 className="text-2xl mb-3">Notifications</h2>
        <div className="space-y-3">
          {client.notifications.length === 0 && (
            <p className="text-sm text-[var(--gc-muted)]">No notifications</p>
          )}
          {client.notifications.map((n) => (
            <div key={n.id} className="border-b border-[var(--gc-border)] pb-3">
              <p className="font-medium text-sm">{n.title}</p>
              <p className="text-xs text-[var(--gc-muted)]">{n.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
