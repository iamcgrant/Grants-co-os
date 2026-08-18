import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { collectSystemHealth } from "@/lib/system/health";

const STATUS_COLOR: Record<string, string> = {
  CONNECTED: "text-[var(--gc-success)]",
  DEGRADED: "text-[var(--gc-warning)]",
  ACTION_REQUIRED: "text-[var(--gc-gold)]",
  OFFLINE: "text-[var(--gc-danger)]",
};

export default async function SystemHealthPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_OWNER_COMMAND")) redirect("/home");

  const health = await collectSystemHealth();

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">Infrastructure</p>
      <h1 className="text-4xl mb-2">System Health</h1>
      <p className="gc-section-sub mb-8">
        Overall{" "}
        <span className={STATUS_COLOR[health.overall]}>{health.overall.replaceAll("_", " ")}</span>
        {" · "}
        {health.environment} · checked {new Date(health.checkedAt).toLocaleString()}
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {health.components.map((c) => (
          <div key={c.component} className="gc-card">
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="text-lg display">{c.label}</p>
              <span className={`text-[0.65rem] tracking-[0.14em] uppercase ${STATUS_COLOR[c.status]}`}>
                {c.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="text-sm text-[var(--gc-muted)] leading-relaxed">{c.detail}</p>
            <p className="text-[0.65rem] text-[var(--gc-muted)] mt-4">
              Last success:{" "}
              {c.lastSuccessAt ? new Date(c.lastSuccessAt).toLocaleString() : "DATA UNAVAILABLE"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
