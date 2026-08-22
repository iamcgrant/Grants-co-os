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
  const [commasCheckoutUrl, setCommasCheckoutUrl] = useState("");
  const [recordedUrls, setRecordedUrls] = useState<string[]>([]);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [result, setResult] = useState<string>("");
  const [copyUrl, setCopyUrl] = useState("");
  const [invoiceHref, setInvoiceHref] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lockedClientId) {
      setClientId(lockedClientId);
    } else {
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
    }

    void fetch("/api/pay/commas-checkouts")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.urls)) setRecordedUrls(d.urls as string[]);
      })
      .catch(() => undefined);
  }, [lockedClientId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult("");
    setCopyUrl("");
    setInvoiceHref("");
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
          commasCheckoutUrl: commasCheckoutUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const invoiceNumber = data.invoice?.invoiceNumber as string | undefined;
      setCopyUrl(typeof data.link?.url === "string" ? data.link.url : "");
      setInvoiceHref(invoiceNumber ? `/pay/invoices/${invoiceNumber}` : "");
      setResult(
        `Invoice ${data.invoice.invoiceNumber} · ${data.request.publicId} · ${data.request.status}`,
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
        Create invoice
      </p>
      <p className="text-sm text-[var(--gc-muted)]">
        Issue the invoice in Grants OS. Official Commas / Fanbasis checkout is the last step only.
        Fanbasis has no API Keys page — do not invent a key.
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
      {recordedUrls.length > 0 ? (
        <select
          className="gc-input"
          value=""
          onChange={(e) => setCommasCheckoutUrl(e.target.value)}
        >
          <option value="">Pick a recorded Commas checkout</option>
          {recordedUrls.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      ) : null}
      <input
        className="gc-input"
        value={commasCheckoutUrl}
        onChange={(e) => setCommasCheckoutUrl(e.target.value)}
        placeholder="Official Commas checkout URL (optional)"
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
        {loading ? "Creating…" : "Create invoice"}
      </button>
      {copyUrl ? (
        <button type="button" className="gc-btn gc-btn-outline w-full" onClick={() => void copyLink()}>
          Copy payment link
        </button>
      ) : null}
      {invoiceHref ? (
        <a href={invoiceHref} className="gc-btn gc-btn-ghost w-full text-center">
          Open invoice
        </a>
      ) : null}
      {error ? <p className="text-sm text-[var(--gc-danger)]">{error}</p> : null}
      {result ? <p className="text-sm text-[var(--gc-success)] break-all">{result}</p> : null}
    </form>
  );
}
