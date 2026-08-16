"use client";

import { useState } from "react";

type PullResponse = {
  ready?: boolean;
  fetched?: number;
  message?: string;
  error?: string;
  awaitingIntegration?: boolean;
  dataPlane?: string;
  results?: { action: string; grantsClientId?: string; ghlContactId: string }[];
};

export function GhlSyncPanel({ canSync }: { canSync: boolean }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PullResponse | null>(null);

  async function runPull() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/integrations/ghl/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "pull",
          query: query.trim() || undefined,
          limit: 25,
        }),
      });
      const data = (await res.json()) as PullResponse;
      setResult(data);
    } catch {
      setResult({ error: "Sync request failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gc-card space-y-3">
      <div>
        <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-ice)] mb-1">
          GoHighLevel → Grants Client
        </p>
        <p className="text-sm text-[var(--gc-muted)]">
          Pull real contacts into master client records. Never duplicates. Never sends messages.
        </p>
      </div>
      {canSync ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="gc-input flex-1"
            placeholder="Optional search (name, email, phone)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={busy}
          />
          <button type="button" className="gc-btn gc-btn-ice" onClick={runPull} disabled={busy}>
            {busy ? "Syncing…" : "Pull from GHL"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-[var(--gc-muted)]">Owner/manager access required to sync.</p>
      )}
      {result && (
        <div className="text-sm space-y-1">
          {result.awaitingIntegration || result.ready === false ? (
            <p className="gc-status gc-status-warn">Awaiting Integration — GHL API key + Location ID</p>
          ) : result.error ? (
            <p className="gc-status gc-status-danger">{result.error}</p>
          ) : (
            <>
              <p className="text-[var(--gc-muted)]">
                Data plane: {result.dataPlane || "—"} · Fetched {result.fetched ?? 0}
              </p>
              <ul className="text-xs text-[var(--gc-muted)] max-h-40 overflow-auto space-y-1">
                {(result.results || []).map((r) => (
                  <li key={`${r.ghlContactId}-${r.action}`}>
                    {r.action}
                    {r.grantsClientId ? ` → ${r.grantsClientId}` : ""} · GHL {r.ghlContactId}
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.message && <p className="text-xs text-[var(--gc-muted)]">{result.message}</p>}
        </div>
      )}
    </div>
  );
}
