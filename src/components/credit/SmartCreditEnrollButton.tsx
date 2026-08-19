"use client";

import { useState } from "react";

type ClientOption = { id: string; grantsClientId: string; name: string };

export function SmartCreditEnrollButton({ clients }: { clients: ClientOption[] }) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [msg, setMsg] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function enroll() {
    setLoading(true);
    setMsg("");
    setUrl(null);
    try {
      const res = await fetch("/api/credit/smartcredit/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = (await res.json()) as {
        error?: string;
        enrollmentUrl?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed");
      setUrl(data.enrollmentUrl || null);
      setMsg(data.message || "Enrollment link ready");
      if (data.enrollmentUrl) {
        window.open(data.enrollmentUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gc-panel p-5 space-y-4">
      <label className="block text-sm">
        <span className="text-[var(--gc-muted)]">Master client</span>
        <select
          className="gc-search mt-1 w-full"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.grantsClientId} · {c.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="gc-btn gc-btn-gold" onClick={() => void enroll()} disabled={loading}>
        {loading ? "Building link…" : "Open sponsored enrollment"}
      </button>
      {url ? (
        <p className="text-sm break-all">
          <a href={url} className="text-[var(--gc-gold)]" target="_blank" rel="noreferrer">
            {url}
          </a>
        </p>
      ) : null}
      {msg ? <p className="text-sm text-[var(--gc-muted)]">{msg}</p> : null}
    </div>
  );
}
