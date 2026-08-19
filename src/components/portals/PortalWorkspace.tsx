"use client";

import { useState } from "react";
import type { PortalProviderId } from "@/lib/portals/catalog";

type ClientOption = { id: string; grantsClientId: string; name: string };

const RESULTS = [
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "FILED", label: "Filed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "NO_ACTION", label: "No action" },
  { value: "BLOCKED", label: "Blocked" },
] as const;

export function PortalWorkspace({
  provider,
  officialUrl,
  iframeAllowed,
  clients,
}: {
  provider: PortalProviderId;
  officialUrl: string;
  iframeAllowed: boolean;
  clients: ClientOption[];
}) {
  const [clientId, setClientId] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [externalRef, setExternalRef] = useState("");
  const [notes, setNotes] = useState("");
  const [resultStatus, setResultStatus] = useState<(typeof RESULTS)[number]["value"]>("FILED");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/portals/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, clientId: clientId || undefined, notes }),
      });
      const data = (await res.json()) as {
        error?: string;
        session?: { id: string };
        portalUrl?: string;
        launchMode?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to open");
      setSessionId(data.session?.id || null);
      if (data.portalUrl) {
        window.open(data.portalUrl, "_blank", "noopener,noreferrer");
      }
      setMsg(
        data.launchMode === "IFRAME"
          ? "Session opened · embed below if the host allows it"
          : "Session opened · official portal in a new tab",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveResult() {
    if (!sessionId) {
      setMsg("Open the portal first so the visit is attributed.");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/portals/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultStatus, externalRef, notes }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setMsg("Result saved on the client timeline and audit log.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--gc-muted)]">
        Official URL:{" "}
        <a href={officialUrl} className="text-[var(--gc-gold)]" target="_blank" rel="noreferrer">
          {officialUrl}
        </a>
        {" · "}
        {iframeAllowed ? "iframe allowlisted" : "new tab only (host does not allow embed)"}
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-[var(--gc-muted)]">Master client</span>
          <select
            className="gc-search mt-1 w-full"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Unassigned visit</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.grantsClientId} · {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--gc-muted)]">Notes</span>
          <input
            className="gc-search mt-1 w-full"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Why this visit"
          />
        </label>
      </div>

      <button type="button" className="gc-btn gc-btn-gold" onClick={() => void openPortal()} disabled={loading}>
        {loading ? "Working…" : "Open official portal"}
      </button>

      {iframeAllowed ? (
        <iframe
          title={`${provider} portal`}
          src={officialUrl}
          className="w-full min-h-[420px] rounded-xl border border-[var(--gc-border)] bg-white"
        />
      ) : null}

      <div className="gc-panel p-4 space-y-3">
        <p className="gc-eyebrow">Record result</p>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block text-sm">
            <span className="text-[var(--gc-muted)]">Outcome</span>
            <select
              className="gc-search mt-1 w-full"
              value={resultStatus}
              onChange={(e) =>
                setResultStatus(e.target.value as (typeof RESULTS)[number]["value"])
              }
            >
              {RESULTS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-[var(--gc-muted)]">External ref (complaint / case id)</span>
            <input
              className="gc-search mt-1 w-full"
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>
        <button type="button" className="gc-btn gc-btn-outline" onClick={() => void saveResult()} disabled={loading}>
          Save result
        </button>
      </div>

      {msg ? <p className="text-sm text-[var(--gc-gold)]">{msg}</p> : null}
    </div>
  );
}
