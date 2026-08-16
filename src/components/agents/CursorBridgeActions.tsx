"use client";

import { useState } from "react";

export function CursorBridgeActions() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(action: "drain" | "sync" | "probe") {
    setBusy(true);
    setMsg(null);
    try {
      if (action === "probe") {
        const res = await fetch("/api/agent-hub/cursor");
        const data = await res.json();
        setMsg(
          data.launchReady
            ? `Cursor bridge ready · ${data.probe?.valid ? "key valid" : data.probe?.message || "key present"}`
            : `Awaiting Cursor API key · ${data.probe?.message || "not in env"}`,
        );
      } else {
        const res = await fetch("/api/agent-hub/cursor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        setMsg(
          action === "drain"
            ? data.ready
              ? `Drained ${data.count ?? data.drained?.length ?? 0} task(s)`
              : data.message || "Not ready"
            : `Synced · checked ${data.checked ?? 0} · updated ${data.updated ?? 0}`,
        );
      }
    } catch {
      setMsg("Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="gc-btn gc-btn-outline text-xs" disabled={busy} onClick={() => run("probe")}>
        Probe Cursor key
      </button>
      <button type="button" className="gc-btn gc-btn-ice text-xs" disabled={busy} onClick={() => run("drain")}>
        Drain launch queue
      </button>
      <button type="button" className="gc-btn gc-btn-outline text-xs" disabled={busy} onClick={() => run("sync")}>
        Sync Cursor → Hub
      </button>
      {msg && <span className="text-xs text-[var(--gc-muted)]">{msg}</span>}
    </div>
  );
}
