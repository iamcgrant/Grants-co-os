"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function SbtpgPayoutForm({
  clients,
}: {
  clients: Array<{ id: string; grantsClientId: string; firstName: string; lastName: string }>;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("PAID");
  const [paidAt, setPaidAt] = useState("");
  const [externalId, setExternalId] = useState("");
  const [taxYear, setTaxYear] = useState("");
  const [notes, setNotes] = useState("");
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function recordOne(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/tax/sbtpg/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          status,
          clientId: clientId || undefined,
          paidAt: paidAt || undefined,
          externalId: externalId || undefined,
          taxYear: taxYear || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not record SBTPG payout");
      setAmount("");
      setExternalId("");
      setNotes("");
      setMessage("Official SBTPG payout recorded in OS — Command Center collected totals update.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not record SBTPG payout");
    } finally {
      setBusy(false);
    }
  }

  async function importOfficial(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/tax/sbtpg/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not import official payouts");
      setImportText("");
      setMessage(`Imported ${data.imported ?? 0} official SBTPG payout total(s).`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not import official payouts");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={recordOne} className="gc-card space-y-3">
        <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)]">
          Record official payout
        </p>
        <p className="text-sm text-[var(--gc-muted)]">
          Land the official SBTPG payout total in OS. No scrape of the portal.
        </p>
        <select className="gc-input w-full" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Firm / period total (no client)</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.grantsClientId} · {c.firstName} {c.lastName}
            </option>
          ))}
        </select>
        <input
          className="gc-input w-full"
          placeholder="Amount (USD)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <select className="gc-input w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["PAID", "FUNDED", "APPROVED", "PENDING", "HOLD", "REJECTED", "CLOSED"].map((row) => (
            <option key={row} value={row}>
              {row}
            </option>
          ))}
        </select>
        <input
          className="gc-input w-full"
          type="date"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
        />
        <input
          className="gc-input w-full"
          placeholder="Official SBTPG payout / refund id"
          value={externalId}
          onChange={(e) => setExternalId(e.target.value)}
        />
        <input
          className="gc-input w-full"
          placeholder="Tax year"
          value={taxYear}
          onChange={(e) => setTaxYear(e.target.value)}
        />
        <textarea
          className="gc-input w-full min-h-[72px]"
          placeholder="Notes from the official payout"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="submit" className="gc-btn gc-btn-gold text-xs" disabled={busy}>
          {busy ? "Recording…" : "Record collected payout"}
        </button>
      </form>

      <form onSubmit={importOfficial} className="gc-card space-y-3">
        <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)]">
          Import official totals
        </p>
        <p className="text-sm text-[var(--gc-muted)]">
          Paste official payout rows as CSV (`amount,status,paidAt,id,taxYear,notes`) or JSON. Staff-entered
          official numbers only.
        </p>
        <textarea
          className="gc-input w-full min-h-[220px]"
          placeholder={'1840.00,PAID,2026-08-21,sbt_ref_1,2025,August payout\n[{"amount":990.00,"status":"FUNDED","paidAt":"2026-08-20"}]'}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          required
        />
        <button type="submit" className="gc-btn gc-btn-ice text-xs" disabled={busy}>
          {busy ? "Importing…" : "Import official totals"}
        </button>
      </form>
      {message ? <p className="text-sm text-[var(--gc-gold)] lg:col-span-2">{message}</p> : null}
    </div>
  );
}
