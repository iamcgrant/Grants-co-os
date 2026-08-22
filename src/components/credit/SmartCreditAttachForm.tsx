"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function SmartCreditAttachForm({
  clients,
  lockedClientId,
}: {
  clients: Array<{ id: string; grantsClientId: string; firstName: string; lastName: string }>;
  lockedClientId?: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(lockedClientId || clients[0]?.id || "");
  const [externalId, setExternalId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/credit/smartcredit/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, externalId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not attach");
      setExternalId("");
      setMessage(`Attached ${data.identifier.externalId}`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not attach");
    } finally {
      setBusy(false);
    }
  }

  if (!lockedClientId && clients.length === 0) {
    return <p className="text-sm text-[var(--gc-muted)]">Add a Grants client first, then attach SmartCredit here.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="gc-card max-w-xl space-y-3">
      <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)]">Attach client</p>
      <p className="text-sm text-[var(--gc-muted)]">
        Record the SmartCredit member id the client already has. Do not invent an id.
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
      <input
        className="gc-input w-full"
        placeholder="SmartCredit member / account id"
        value={externalId}
        onChange={(e) => setExternalId(e.target.value)}
        required
      />
      <button type="submit" className="gc-btn gc-btn-gold text-xs" disabled={busy}>
        {busy ? "Attaching…" : "Attach in OS"}
      </button>
      {message ? <p className="text-sm text-[var(--gc-gold)]">{message}</p> : null}
    </form>
  );
}
