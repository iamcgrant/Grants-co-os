import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { CreatePaymentRequestForm } from "@/components/pay/CreatePaymentRequestForm";

export default async function AutomationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "MANAGE_OPERATIONS")) redirect("/home");

  const runs = await prisma.automationRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { client: { select: { grantsClientId: true, firstName: true, lastName: true } } },
  });
  const exceptions = await prisma.exceptionTicket.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">Lifecycle</p>
      <h1 className="text-4xl mb-2">Automations</h1>
      <p className="gc-section-sub mb-8">
        Server-side client lifecycle · owner interrupted only for real exceptions
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-xl mb-4">Recent runs</h2>
          <div className="space-y-3">
            {runs.map((r) => (
              <div key={r.id} className="gc-card">
                <div className="flex justify-between gap-3">
                  <p className="font-medium">{r.kind}</p>
                  <span className="text-[0.65rem] tracking-[0.14em] uppercase text-[var(--gc-muted)]">
                    {r.status}
                  </span>
                </div>
                <p className="text-sm text-[var(--gc-muted)] mt-1">
                  {r.client
                    ? `${r.client.firstName} ${r.client.lastName} · ${r.client.grantsClientId}`
                    : "System"}
                  {r.errorMessage ? ` · ${r.errorMessage}` : ""}
                </p>
              </div>
            ))}
            {!runs.length ? (
              <p className="text-[var(--gc-muted)]">No automation runs yet.</p>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="text-xl mb-4">Open exceptions</h2>
          <div className="space-y-3">
            {exceptions.map((e) => (
              <div key={e.id} className="gc-card border-[var(--gc-danger)]/30">
                <p className="font-medium">{e.title}</p>
                <p className="text-sm text-[var(--gc-muted)] mt-1">{e.detail}</p>
              </div>
            ))}
            {!exceptions.length ? (
              <p className="text-[var(--gc-success)] text-sm">No open exceptions.</p>
            ) : null}
          </div>

          {hasPermission(user.role, "MANAGE_PAYMENTS") ? (
            <div className="mt-10">
              <h2 className="text-xl mb-4">Quick payment request</h2>
              <CreatePaymentRequestForm />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
