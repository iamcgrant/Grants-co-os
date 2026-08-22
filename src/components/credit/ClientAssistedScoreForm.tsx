"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CLIENT_ASSISTED_SOURCE } from "@/lib/credit/client-assisted-source";

export function ClientAssistedScoreForm({
  clients,
}: {
  clients: Array<{ id: string; grantsClientId: string; firstName: string; lastName: string }>;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [bureau, setBureau] = useState("EXPERIAN");
  const [score, setScore] = useState("");
  const [scoringModel, setScoringModel] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/credit/client-assisted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          bureau,
          score: Number(score),
          scoringModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setScore("");
      setMessage(`Saved ${data.score.score} for ${bureau}`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (clients.length === 0) {
    return <p className="text-sm text-[var(--gc-muted)]">Add a Grants client first.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="gc-card max-w-xl space-y-4" aria-label="Client-assisted Credit Karma score entry">
      <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)]">
        Client reports the score · staff records it · no scrape
      </p>
      <label className="block">
        <span className="text-xs text-[var(--gc-muted)]">Grants Client</span>
        <select className="gc-input mt-1 w-full" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.grantsClientId} · {c.firstName} {c.lastName}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-[var(--gc-muted)]">Bureau the client read in Credit Karma</span>
        <select className="gc-input mt-1 w-full" value={bureau} onChange={(e) => setBureau(e.target.value)}>
          <option value="EXPERIAN">Experian</option>
          <option value="EQUIFAX">Equifax</option>
          <option value="TRANSUNION">TransUnion</option>
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-[var(--gc-muted)]">Score</span>
        <input className="gc-input mt-1 w-full" inputMode="numeric" value={score} onChange={(e) => setScore(e.target.value)} required />
      </label>
      <label className="block">
        <span className="text-xs text-[var(--gc-muted)]">Scoring model as reported</span>
        <input className="gc-input mt-1 w-full" value={scoringModel} onChange={(e) => setScoringModel(e.target.value)} placeholder="VantageScore 3.0" required />
      </label>
      <label className="block">
        <span className="text-xs text-[var(--gc-muted)]">Source</span>
        <input className="gc-input mt-1 w-full" value={CLIENT_ASSISTED_SOURCE} readOnly />
      </label>
      <button type="submit" className="gc-btn gc-btn-gold text-xs" disabled={busy}>
        {busy ? "Saving…" : "Save client-assisted score"}
      </button>
      {message ? <p className="text-sm text-[var(--gc-muted)]">{message}</p> : null}
    </form>
  );
}
