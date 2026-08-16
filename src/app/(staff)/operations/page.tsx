import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getOperationsDashboard } from "@/lib/ops/dashboard";

export default async function OperationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "MANAGE_OPERATIONS")) {
    return <p>Access denied.</p>;
  }

  const dash = await getOperationsDashboard(
    user.role === "FILE_PREPARER" || user.role === "CUSTOMER_SERVICE" ? user.id : undefined,
  );

  return (
    <div>
      <div className="gc-fade-up mb-10">
        <p className="text-[0.7rem] tracking-[0.3em] uppercase text-[var(--gc-gold)] mb-2">
          Grants Operations
        </p>
        <h1 className="text-4xl md:text-5xl mb-2">Today</h1>
        <p className="text-sm text-[var(--gc-muted)]">Who · What · When · Next action</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 gc-fade-up-delay">
        {[
          ["Payment Issues", dash.queues.paymentIssues],
          ["Missing Docs", dash.queues.missingDocuments],
          ["Credit Updates", dash.queues.creditUpdates],
          ["Open Tasks", dash.queues.openTasks],
        ].map(([label, value]) => (
          <div key={String(label)} className="gc-metric">
            <p className="text-[0.65rem] tracking-[0.18em] uppercase text-[var(--gc-muted)]">{label}</p>
            <p className="display text-4xl">{value}</p>
          </div>
        ))}
      </div>

      <section className="mb-12">
        <h2 className="text-2xl mb-4">Tasks</h2>
        <div className="divide-y divide-[var(--gc-border)]">
          {dash.tasks.map((t) => (
            <div key={t.id} className="py-4">
              <p className="font-medium">{t.title}</p>
              <p className="text-xs text-[var(--gc-muted)] mt-1">
                {t.client
                  ? `${t.client.firstName} ${t.client.lastName} · ${t.client.grantsClientId}`
                  : "No client"}
                {t.assignee ? ` · ${t.assignee.firstName} ${t.assignee.lastName}` : ""}
                {t.dueAt ? ` · Due ${new Date(t.dueAt).toLocaleDateString()}` : ""}
                {` · ${t.priority}`}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl mb-4">Staff Workload</h2>
        <div className="space-y-3">
          {dash.workload.map((w, i) => (
            <div key={i} className="flex justify-between py-2 border-b border-[var(--gc-border)]">
              <span>
                {w.staff ? `${w.staff.firstName} ${w.staff.lastName}` : "Unassigned"}
              </span>
              <span className="text-[var(--gc-muted)]">{w.openCount} open</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
