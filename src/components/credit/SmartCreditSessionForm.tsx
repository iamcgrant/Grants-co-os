"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SMARTCREDIT_SESSION_KINDS,
  sessionKindLabel,
  type SmartCreditSessionKind,
} from "@/lib/credit/smartcredit-catalog";

export function SmartCreditSessionForm({
  clients,
  lockedClientId,
}: {
  clients: Array<{ id: string; grantsClientId: string; firstName: string; lastName: string }>;
  lockedClientId?: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(lockedClientId || clients[0]?.id || "");
  const [kind, setKind] = useState<SmartCreditSessionKind>("SCORE_REVIEW");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState("");
  const [message, setMessage] = useState("");
  const [lastStepUrl, setLastStepUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setLastStepUrl(null);
    try {
      const res = await fetch("/api/credit/smartcredit/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, kind, notes, result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not record session");
      setNotes("");
      setResult("");
      setLastStepUrl(typeof data.lastStepUrl === "string" ? data.lastStepUrl : null);
      setMessage(`Recorded ${sessionKindLabel(kind)}`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not record session");
    } finally {
      setBusy(false);
    }
  }

  if (!lockedClientId && clients.length === 0) {
    return <p className="text-sm text-[var(--gc-muted)]">Add a Grants client first, then record a session.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="gc-card max-w-xl space-y-3">
      <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)]">Launch / session</p>
      <p className="text-sm text-[var(--gc-muted)]">
        No public SmartCredit API. Record the session in OS. Official site is a last step only when enrollment or login
        is required.
      </p>
      {lockedClientId ? null : (
        <select className="gc-input w-full" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.grantsClientId} · {c.firstName} {c.lastName}
            </option>
          ))}
        </select>
      )}
      <select
        className="gc-input w-full"
        value={kind}
        onChange={(e) => setKind(e.target.value as SmartCreditSessionKind)}
      >
        {SMARTCREDIT_SESSION_KINDS.map((row) => (
          <option key={row} value={row}>
            {sessionKindLabel(row)}
          </option>
        ))}
      </select>
      <textarea
        className="gc-input w-full min-h-[80px]"
        placeholder="What staff did in this session"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <input
        className="gc-input w-full"
        placeholder="Result (optional)"
        value={result}
        onChange={(e) => setResult(e.target.value)}
      />
      <button type="submit" className="gc-btn gc-btn-outline text-xs" disabled={busy}>
        {busy ? "Recording…" : "Record session"}
      </button>
      {message ? <p className="text-sm text-[var(--gc-gold)]">{message}</p> : null}
      {lastStepUrl ? (
        <p className="text-sm text-[var(--gc-muted)]">
          Last step only (not the workspace):{" "}
          <a className="text-[var(--gc-ice)]" href={lastStepUrl} target="_blank" rel="noreferrer">
            official SmartCredit step
          </a>
          .
        </p>
      ) : null}
    </form>
  );
}
