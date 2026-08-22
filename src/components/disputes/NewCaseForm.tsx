"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { DisputeChannel } from "@/lib/disputes/channels";

export function NewCaseForm({
  channel,
  clients,
  detailHref,
}: {
  channel: DisputeChannel;
  clients: Array<{ id: string; grantsClientId: string; firstName: string; lastName: string }>;
  detailHref: (caseId: string) => string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/credit/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, clientId, title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open case");
      router.push(detailHref(data.case.id));
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not open case");
    } finally {
      setBusy(false);
    }
  }

  if (clients.length === 0) {
    return <p className="text-sm text-[var(--gc-muted)]">Add a Grants client first, then open a case here.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="gc-card max-w-xl space-y-3">
      <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)]">Open case</p>
      <select className="gc-input w-full" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.grantsClientId} · {c.firstName} {c.lastName}
          </option>
        ))}
      </select>
      <input className="gc-input w-full" placeholder="Case title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <button type="submit" className="gc-btn gc-btn-gold text-xs" disabled={busy}>
        {busy ? "Opening…" : "Open OS case"}
      </button>
      {message ? <p className="text-sm text-[var(--gc-gold)]">{message}</p> : null}
    </form>
  );
}
