"use client";

import { useState } from "react";

type ClientOption = { id: string; grantsClientId: string; name: string };

export function AssistedKarmaForm({ clients }: { clients: ClientOption[] }) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [equifax, setEquifax] = useState("");
  const [transunion, setTransunion] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMsg("");
    const scores = [];
    if (equifax) scores.push({ bureau: "EQUIFAX" as const, score: Number(equifax) });
    if (transunion) scores.push({ bureau: "TRANSUNION" as const, score: Number(transunion) });
    try {
      const res = await fetch("/api/credit/karma/assisted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, scores, notes }),
      });
      const data = (await res.json()) as { error?: string; grantsClientId?: string };
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(`Recorded client-assisted scores for ${data.grantsClientId}`);
      setEquifax("");
      setTransunion("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gc-panel p-5 space-y-4">
      <p className="text-sm text-[var(--gc-muted)]">
        Client reads Credit Karma on their own device. Staff types the numbers. OS never logs into Credit
        Karma and never scrapes.
      </p>
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
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-[var(--gc-muted)]">Equifax (300–850)</span>
          <input
            className="gc-search mt-1 w-full"
            inputMode="numeric"
            value={equifax}
            onChange={(e) => setEquifax(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--gc-muted)]">TransUnion (300–850)</span>
          <input
            className="gc-search mt-1 w-full"
            inputMode="numeric"
            value={transunion}
            onChange={(e) => setTransunion(e.target.value)}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-[var(--gc-muted)]">Notes</span>
        <input
          className="gc-search mt-1 w-full"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Client read these from Credit Karma on …"
        />
      </label>
      <button type="button" className="gc-btn gc-btn-gold" onClick={() => void submit()} disabled={loading}>
        {loading ? "Saving…" : "Save assisted scores"}
      </button>
      {msg ? <p className="text-sm text-[var(--gc-gold)]">{msg}</p> : null}
    </div>
  );
}
