"use client";

import { useState } from "react";

export function FridayPulseButton({ clientId }: { clientId: string }) {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/credit-pulse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(`Pulse complete · ${data.result.scoreCount} scores`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button type="button" className="gc-btn gc-btn-ghost" onClick={() => void run()} disabled={loading}>
        {loading ? "Running…" : "Run Friday Pulse"}
      </button>
      {msg && <p className="text-xs text-[var(--gc-muted)] mt-1">{msg}</p>}
    </div>
  );
}
