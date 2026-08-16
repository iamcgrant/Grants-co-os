"use client";

import { useState } from "react";

type PullResponse = {
  ready?: boolean;
  dryRun?: boolean;
  failedClosed?: boolean;
  missingScope?: boolean;
  linkedMasters?: number;
  fetchedConversations?: number;
  imported?: number;
  duplicates?: number;
  message?: string;
  error?: string;
  awaitingIntegration?: boolean;
  dataPlane?: string;
  requiredSecrets?: string[];
  requiredScope?: string;
  additionalScopesNeeded?: string[];
};

export function GhlConversationPullPanel({ canSync }: { canSync: boolean }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PullResponse | null>(null);

  async function runPull(dryRun: boolean) {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/integrations/ghl/conversations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const data = (await res.json()) as PullResponse;
      setResult(data);
    } catch {
      setResult({ error: "Conversation pull failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gc-card space-y-3">
      <div>
        <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-ice)] mb-1">
          GoHighLevel → Inbox
        </p>
        <p className="text-sm text-[var(--gc-muted)]">
          Pull existing GHL conversations into the Grants OS inbox for already-linked master
          clients only. Read-only. Never sends SMS, email, or iMessage. Never creates contacts or
          clients.
        </p>
      </div>
      {canSync ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            className="gc-btn gc-btn-outline"
            onClick={() => runPull(true)}
            disabled={busy}
          >
            {busy ? "Working…" : "Dry run inbox pull"}
          </button>
          <button
            type="button"
            className="gc-btn gc-btn-ice"
            onClick={() => runPull(false)}
            disabled={busy}
          >
            {busy ? "Pulling…" : "Pull conversations"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-[var(--gc-muted)]">Owner/manager access required to pull.</p>
      )}
      {result && (
        <div className="text-sm space-y-1">
          {result.awaitingIntegration || result.ready === false || result.failedClosed ? (
            <p className="gc-status gc-status-warn">
              Fail-closed
              {result.missingScope && result.requiredScope
                ? ` — PIT needs ${result.requiredScope}`
                : ` — set ${result.requiredSecrets?.join(", ") || "GHL_API_KEY"} in host secrets`}
            </p>
          ) : result.error ? (
            <p className="gc-status gc-status-danger">{result.error}</p>
          ) : (
            <p className="text-[var(--gc-muted)]">
              Data plane: {result.dataPlane || "—"} · Linked {result.linkedMasters ?? 0} ·
              Conversations {result.fetchedConversations ?? 0} · Imported {result.imported ?? 0} ·
              Duplicates {result.duplicates ?? 0}
            </p>
          )}
          {result.message && <p className="text-xs text-[var(--gc-muted)]">{result.message}</p>}
        </div>
      )}
    </div>
  );
}
