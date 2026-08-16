"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type InvoicePayload = {
  id: string;
  invoiceNumber: string;
  status: string;
  amountCents: number;
  amountPaidCents: number;
  description: string | null;
  serviceName: string;
  client: {
    grantsClientId: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function GrantsPayPage() {
  const params = useParams<{ invoiceNumber: string }>();
  const invoiceNumber = params.invoiceNumber;
  const [invoice, setInvoice] = useState<InvoicePayload | null>(null);
  const [token, setToken] = useState("tok_visa_4242");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{
    receiptNumber: string;
    amountCents: number;
    invoiceNumber: string;
    paidAt: string;
    clientName: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const idempotencyKey = useMemo(
    () => `checkout-${invoiceNumber}-${Date.now()}`,
    // regenerate only when invoice changes for UX; user can still retry with new key via fail/success paths
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoiceNumber],
  );
  const [currentKey, setCurrentKey] = useState(idempotencyKey);

  useEffect(() => {
    setCurrentKey(idempotencyKey);
  }, [idempotencyKey]);

  useEffect(() => {
    void fetch(`/api/pay/invoice/${invoiceNumber}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.invoice) setInvoice(d.invoice);
        else setError(d.error || "Invoice not found");
      });
  }, [invoiceNumber]);

  async function pay(simulateFailure = false) {
    if (!invoice) return;
    setLoading(true);
    setError("");
    try {
      const key = simulateFailure ? `${currentKey}-fail-${Date.now()}` : currentKey;
      const res = await fetch("/api/pay/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          paymentToken: simulateFailure ? "fail" : token,
          idempotencyKey: key,
          simulateFailure,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");
      if (data.receipt) {
        setReceipt(data.receipt);
        setInvoice({ ...invoice, status: data.invoice.status, amountPaidCents: data.invoice.amountPaidCents });
      } else if (data.transaction?.status === "FAILED") {
        setError(data.transaction.failureMessage || "Payment failed");
        setInvoice({ ...invoice, status: "FAILED" });
        setCurrentKey(`checkout-${invoiceNumber}-${Date.now()}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void pay(false);
  }

  if (!invoice && !error) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <p className="text-[var(--gc-muted)] animate-[gc-pulse-soft_1.4s_ease_infinite]">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="gc-fade-up text-center mb-10">
          <p className="text-[0.75rem] tracking-[0.4em] uppercase text-[var(--gc-champagne-dim)] mb-3">
            Grants &amp; Co
          </p>
          <h1 className="text-4xl mb-2">Secure Payment</h1>
          <div className="gc-gold-line my-6" />
        </div>

        {receipt ? (
          <div className="gc-fade-up text-center space-y-4">
            <p className="text-[0.7rem] tracking-[0.2em] uppercase text-[var(--gc-success)]">Payment Successful</p>
            <p className="display text-5xl">{formatUsd(receipt.amountCents)}</p>
            <p className="text-sm text-[var(--gc-muted)]">
              {receipt.clientName}
              <br />
              Invoice {receipt.invoiceNumber}
              <br />
              Receipt {receipt.receiptNumber}
            </p>
            <a href="/dashboard" className="gc-btn gc-btn-primary inline-flex mt-4">
              Return to OS
            </a>
          </div>
        ) : invoice && (invoice.status === "SUCCEEDED" || invoice.status === "REFUNDED" || invoice.status === "PARTIALLY_REFUNDED") ? (
          <div className="gc-fade-up text-center space-y-4">
            <p className="text-[0.7rem] tracking-[0.2em] uppercase text-[var(--gc-muted)]">
              {invoice.status.replaceAll("_", " ")}
            </p>
            <h2 className="text-3xl">
              {invoice.client.firstName} {invoice.client.lastName}
            </h2>
            <p className="display text-5xl">{formatUsd(invoice.amountCents)}</p>
            <p className="text-sm text-[var(--gc-muted)]">Invoice {invoice.invoiceNumber}</p>
            <a href="/dashboard" className="gc-btn gc-btn-primary inline-flex mt-4">
              Return to OS
            </a>
          </div>
        ) : invoice ? (
          <form onSubmit={onSubmit} className="gc-fade-up-delay space-y-6">
            <div className="text-center">
              <p className="text-xl font-medium">
                {invoice.client.firstName} {invoice.client.lastName}
              </p>
              <p className="text-sm text-[var(--gc-muted)] mt-1">{invoice.serviceName}</p>
              <p className="text-[0.7rem] tracking-[0.16em] uppercase text-[var(--gc-muted)] mt-3">
                Invoice {invoice.invoiceNumber}
              </p>
            </div>

            <div className="text-center py-6 border-y border-[var(--gc-border)]">
              <p className="text-[0.65rem] tracking-[0.22em] uppercase text-[var(--gc-muted)] mb-2">
                Amount Due
              </p>
              <p className="display text-5xl">
                {formatUsd(invoice.amountCents - invoice.amountPaidCents)}
              </p>
            </div>

            <div>
              <label className="block text-[0.7rem] tracking-[0.2em] uppercase text-[var(--gc-muted)] mb-2">
                Payment Method
              </label>
              <p className="text-xs text-[var(--gc-muted)] mb-3">
                Production uses processor-hosted tokenization. Never enter raw card numbers into Grants &amp; Co servers.
              </p>
              <input
                className="gc-input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Payment token"
              />
            </div>

            {error && <p className="text-sm text-[var(--gc-danger)] text-center">{error}</p>}

            <button type="submit" className="gc-btn gc-btn-gold w-full" disabled={loading}>
              {loading ? "Processing…" : "Pay Securely"}
            </button>
            <button
              type="button"
              className="gc-btn gc-btn-ghost w-full"
              disabled={loading}
              onClick={() => void pay(true)}
            >
              Simulate Failed Payment
            </button>
          </form>
        ) : (
          <p className="text-center text-[var(--gc-danger)]">{error}</p>
        )}
      </div>
    </main>
  );
}
