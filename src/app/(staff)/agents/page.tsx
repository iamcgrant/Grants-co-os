import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getControlCenterSnapshot } from "@/lib/agent-hub";
import { Panel, MetricTile } from "@/components/ui/density";
import { ApprovalCard } from "@/components/agents/ApprovalCard";
import { CursorBridgeActions } from "@/components/agents/CursorBridgeActions";

function statusTone(status: string) {
  if (status === "WORKING") return "gc-status-ice";
  if (status === "WAITING" || status === "AWAITING_CURSOR_API_KEY") return "gc-status-warn";
  if (status === "ERROR" || status === "BLOCKED") return "gc-status-danger";
  if (status === "IDLE") return "gc-status-ok";
  return "";
}

export default async function AgentControlCenterPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "MANAGE_STAFF") && user.role !== "OWNER" && user.role !== "ADMIN") {
    return <p className="text-[var(--gc-muted)]">Owner/admin access required for Agent Control Center.</p>;
  }

  const snap = await getControlCenterSnapshot();

  return (
    <div className="gc-fade-up space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <p className="gc-eyebrow mb-2">Digital workforce</p>
          <h1 className="text-3xl md:text-4xl mb-1">Agent Control Center</h1>
          <p className="text-sm text-[var(--gc-muted)] max-w-2xl">
            Watch Grants agents operate. Charles is the approval layer — not the messenger.
            {" · "}
            {snap.dataPlane} data plane
            {" · "}
            Policy: RESOLVE BEFORE ESCALATE
          </p>
        </div>
        <Link href="/more#systems" className="gc-btn gc-btn-outline text-xs">
          System health
        </Link>
      </div>

      <div className="gc-dash-grid gc-dash-grid-4">
        <MetricTile label="Active agents" value={snap.agents.filter((a) => a.status !== "IDLE").length || snap.agents.length} />
        <MetricTile label="Open tasks" value={snap.activeTasks.length} tone="ice" />
        <MetricTile
          label="Approvals waiting"
          value={snap.approvals.length}
          tone={snap.approvals.length ? "warn" : "ok"}
        />
        <MetricTile
          label="Cursor bridge"
          value={snap.bridges.cursorLaunch === "READY" ? "Ready" : "Awaiting key"}
          tone={snap.bridges.cursorLaunch === "READY" ? "ok" : "warn"}
        />
      </div>

      <CursorBridgeActions />

      {snap.approvals.length > 0 && (
        <Panel title="Owner approval cards" eyebrow="Level 3 only">
          <div className="grid md:grid-cols-2 gap-3">
            {snap.approvals.map((a) => (
              <ApprovalCard key={a.id} approval={a} />
            ))}
          </div>
        </Panel>
      )}

      <div className="gc-dash-grid gc-dash-grid-12">
        <Panel title="Active agents" eyebrow="Registry" className="gc-span-5">
          <div className="space-y-3">
            {snap.agents.map((a) => (
              <div key={a.id} className="gc-card">
                <div className="flex justify-between gap-2 mb-1">
                  <p className="font-medium">{a.displayName}</p>
                  <span className={`gc-status ${statusTone(a.status)}`}>{a.status}</span>
                </div>
                <p className="text-xs text-[var(--gc-muted)] mb-1">{a.role}</p>
                <p className="text-[0.65rem] uppercase tracking-wider text-[var(--gc-muted)]">
                  {a.mode.replaceAll("_", " ")} · autonomy ≤ {a.maxAutonomyLevel}
                </p>
                {a.currentTaskId && (
                  <p className="text-xs mt-2 text-[var(--gc-ice)]">Task {a.currentTaskId.slice(0, 8)}…</p>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Current work" eyebrow="Tasks" className="gc-span-7">
          <div className="divide-y divide-[var(--gc-border)] max-h-[420px] overflow-y-auto">
            {snap.activeTasks.length === 0 && (
              <p className="py-4 text-sm text-[var(--gc-muted)]">No active tasks.</p>
            )}
            {snap.activeTasks.map((t) => (
              <div key={t.id} className="py-3 flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{t.title}</p>
                  <p className="text-xs text-[var(--gc-muted)]">
                    {(t.assigneeAgent?.displayName || t.assigneeAgentId || "Unassigned") +
                      (t.ownerAgent ? ` · from ${t.ownerAgent.displayName}` : "")}
                    {t.cursorUrl ? ` · Cursor linked` : ""}
                  </p>
                </div>
                <span className="gc-status shrink-0">{t.status.replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="gc-dash-grid gc-dash-grid-12">
        <Panel title="Completed / failed" eyebrow="History" className="gc-span-6">
          <div className="divide-y divide-[var(--gc-border)] max-h-[280px] overflow-y-auto">
            {snap.completedTasks.map((t) => (
              <div key={t.id} className="py-2.5 flex justify-between gap-3">
                <p className="text-sm truncate">{t.title}</p>
                <span className={`gc-status ${t.status === "COMPLETED" ? "gc-status-ok" : "gc-status-danger"}`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="System events" eyebrow="Bus" className="gc-span-6">
          <div className="divide-y divide-[var(--gc-border)] max-h-[280px] overflow-y-auto">
            {snap.events.map((e) => (
              <div key={e.id} className="py-2.5">
                <p className="text-sm font-medium">{e.kind}</p>
                <p className="text-xs text-[var(--gc-muted)]">
                  {e.agent?.displayName || "system"}
                  {e.task?.title ? ` · ${e.task.title}` : ""}
                  {" · "}
                  {e.createdAt.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Bridge modes" eyebrow="External vs native">
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="gc-card">
            <p className="gc-eyebrow mb-2">X1 Operations</p>
            <p className="font-medium mb-1">GRANTS_NATIVE_AGENT</p>
            <p className="text-xs text-[var(--gc-muted)]">
              No supported public API for the legacy chat bot — role implemented inside Agent Hub with persistent identity, tools, and memory.
            </p>
          </div>
          <div className="gc-card">
            <p className="gc-eyebrow mb-2">Payment Processing</p>
            <p className="font-medium mb-1">GRANTS_NATIVE_AGENT</p>
            <p className="text-xs text-[var(--gc-muted)]">
              Same pattern — callable payment capabilities under Grants Pay; no shared processor secrets.
            </p>
          </div>
          <div className="gc-card">
            <p className="gc-eyebrow mb-2">Cursor Engineering</p>
            <p className="font-medium mb-1">EXTERNAL_AGENT</p>
            <p className="text-xs text-[var(--gc-muted)]">
              Cursor Cloud Agents API (`/v1/agents`). Status: {snap.bridges.cursorLaunch}.
            </p>
          </div>
          <div className="gc-card">
            <p className="gc-eyebrow mb-2">GHL / DisputeFox</p>
            <p className="font-medium mb-1">Capabilities under X1</p>
            <p className="text-xs text-[var(--gc-muted)]">
              GHL {snap.bridges.ghl}. Agents call lookup abilities — never receive raw API keys.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
