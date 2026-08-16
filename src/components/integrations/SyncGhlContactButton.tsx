"use client";

import { useState } from "react";

export function SyncGhlContactButton({
  ghlContactId,
  canSync,
}: {
  ghlContactId?: string | null;
  canSync: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!canSync || !ghlContactId) return null;

  async function refresh() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/ghl/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "contact", ghlContactId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.awaitingIntegration ? "Awaiting Integration" : data.error || "Sync failed");
      } else {
        setMsg(`${data.result?.action || "SYNCED"} · ${data.result?.grantsClientId || ""}`);
        window.location.reload();
      }
    } catch {
      setMsg("Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="gc-btn gc-btn-outline text-xs" disabled={busy} onClick={refresh}>
        {busy ? "Refreshing…" : "Refresh from GHL"}
      </button>
      {msg && <span className="text-xs text-[var(--gc-muted)]">{msg}</span>}
    </div>
  );
}
