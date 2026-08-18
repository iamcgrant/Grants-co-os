"use client";

import { FormEvent, useEffect, useState } from "react";

type ClientOption = { id: string; label: string };

export function CreatePaymentRequestForm() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("750.00");
  const [serviceName, setServiceName] = useState("Credit Optimization");
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/clients?limit=50")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.clients || d || []) as Array<{
          id: string;
          firstName: string;
          lastName: string;
          grantsClientId: string;
        }>;
        if (Array.isArray(list)) {
          setClients(
            list.map((c) => ({
              id: c.id,
              label: `${c.firstName} ${c.lastName} · ${c.grantsClientId}`,
            })),
          );
        }
      })
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult("");
    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      const res = await fetch("/api/pay/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          amountCents,
          serviceName,
          sendEmail: true,
          sendSms: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(
        `Created ${data.request.publicId} · Pay: ${data.link.osPayPath} · Copy: ${data.link.url}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="gc-card space-y-3">
      <select
        className="gc-input"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        required
      >
        <option value="">Select client</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        className="gc-input"
        value={serviceName}
        onChange={(e) => setServiceName(e.target.value)}
        placeholder="Service"
      />
      <input
        className="gc-input"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
      />
      <button type="submit" className="gc-btn gc-btn-gold w-full" disabled={loading || !clientId}>
        {loading ? "Creating…" : "Create Payment Request"}
      </button>
      {error ? <p className="text-sm text-[var(--gc-danger)]">{error}</p> : null}
      {result ? <p className="text-sm text-[var(--gc-success)] break-all">{result}</p> : null}
    </form>
  );
}
