"use client";

import { FormEvent, useEffect, useState } from "react";

type ClientOption = { id: string; label: string };

export type CommasHealthProps = {
  configured: boolean;
  environment: string;
  liveChargesEnabled: boolean;
  status: string;
  detail: string;
};

export function CreatePaymentRequestForm({
  lockedClientId,
  lockedLabel,
  commas,
}: {
  lockedClientId?: string;
  lockedLabel?: string;
  commas?: CommasHealthProps;
}) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState(lockedClientId || "");
  const [amount, setAmount] = useState("750.00");
  const [serviceName, setServiceName] = useState("Credit Optimization");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [result, setResult] = useState<string>("");
  const [copyUrl, setCopyUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lockedClientId) {
      setClientId(lockedClientId);
      return;
    }
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
  }, [lockedClientId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult("");
    setCopyUrl("");
    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      const res = await fetch("/api/pay/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          amountCents,
          serviceName,
          sendEmail,
          sendSms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCopyUrl(typeof data.link?.url === "string" ? data.link.url : "");
      setResult(
        `Created ${data.request.publicId} · Pay: ${data.link.osPayPath} · Copy: ${data.link.url}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!copyUrl) return;
    try {
      await navigator.clipboard.writeText(copyUrl);
      setResult("Payment request link copied.");
    } catch {
      setError("Could not copy link");
    }
  }

  return (
    <form onSubmit={onSubmit} className="gc-card space-y-3">
      <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)]">
        Commas payment request
      </p>
      {commas ? (
        <p className="text-sm text-[var(--gc-muted)]">
          {commas.status.replaceAll("_", " ")} · {commas.detail}
        </p>
      ) : null}
      {lockedClientId ? (
        <p className="text-sm">{lockedLabel || "This client"}</p>
      ) : (
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
      )}
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
      <label className="flex items-center gap-2 text-sm text-[var(--gc-muted)]">
        <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
        Queue email via GHL
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--gc-muted)]">
        <input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} />
        Queue SMS via GHL
      </label>
      <button type="submit" className="gc-btn gc-btn-gold w-full" disabled={loading || !clientId}>
        {loading ? "Creating…" : "Create payment request link"}
      </button>
      {copyUrl ? (
        <button type="button" className="gc-btn gc-btn-outline w-full" onClick={() => void copyLink()}>
          Copy payment link
        </button>
      ) : null}
      {error ? <p className="text-sm text-[var(--gc-danger)]">{error}</p> : null}
      {result ? <p className="text-sm text-[var(--gc-success)] break-all">{result}</p> : null}
    </form>
  );
}
