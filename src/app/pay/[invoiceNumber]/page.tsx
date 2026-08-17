"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type AcceptJsCheckout = {
  enabled: boolean;
  environment: "sandbox" | "production";
  scriptUrl: string;
  apiLoginId: string | null;
  clientKey: string | null;
};

type CommasCheckout = {
  enabled: boolean;
  paymentLinkUrl: string | null;
  environment: "sandbox" | "production";
};

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

type AcceptJsOpaqueResponse = {
  opaqueData?: { dataDescriptor?: string; dataValue?: string };
  messages?: {
    resultCode?: string;
    message?: Array<{ code?: string; text?: string }>;
  };
};

declare global {
  interface Window {
    Accept?: {
      dispatchData: (
        payload: {
          authData: { clientKey: string; apiLoginID: string };
          cardData: { cardNumber: string; month: string; year: string; cardCode: string };
        },
        callback: (response: AcceptJsOpaqueResponse) => void,
      ) => void;
    };
  }
}

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

/**
 * Luxury Grants Pay concierge checkout.
 * Commas path: branded OS page → secure Commas payment_link (no PAN/CVV on Grants servers).
 * Mock path: in-OS simulated charge for local QA (never production revenue).
 */
export default function GrantsPayPage() {
  const params = useParams<{ invoiceNumber: string }>();
  const searchParams = useSearchParams();
  const invoiceNumber = params.invoiceNumber;
  const [invoice, setInvoice] = useState<InvoicePayload | null>(null);
  const [acceptJs, setAcceptJs] = useState<AcceptJsCheckout | null>(null);
  const [commas, setCommas] = useState<CommasCheckout | null>(null);
  const [provider, setProvider] = useState("mock");
  const [token, setToken] = useState("tok_visa_4242");
  const [cardNumber, setCardNumber] = useState("");
  const [cardMonth, setCardMonth] = useState("");
  const [cardYear, setCardYear] = useState("");
  const [cardCode, setCardCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [receipt, setReceipt] = useState<{
    receiptNumber: string;
    amountCents: number;
    invoiceNumber: string;
    paidAt: string;
    clientName: string;
  } | null>(null);
  const [continueUrl, setContinueUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canceled = searchParams.get("canceled") === "1";

  const idempotencyKey = useMemo(
    () => `checkout-${invoiceNumber}-${Date.now()}`,
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
        if (d.checkout?.acceptJs) setAcceptJs(d.checkout.acceptJs);
        if (d.checkout?.commas) setCommas(d.checkout.commas);
        if (d.checkout?.provider) setProvider(d.checkout.provider);
      });
  }, [invoiceNumber]);

  useEffect(() => {
    if (!acceptJs?.enabled || !acceptJs.scriptUrl) return;
    if (document.querySelector(`script[data-gc-acceptjs="1"]`)) return;
    const script = document.createElement("script");
    script.src = acceptJs.scriptUrl;
    script.async = true;
    script.dataset.gcAcceptjs = "1";
    document.body.appendChild(script);
  }, [acceptJs]);

  function tokenizeWithAcceptJs(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!acceptJs?.enabled || !acceptJs.apiLoginId || !acceptJs.clientKey) {
        reject(new Error("Authorize.Net Accept.js is not configured."));
        return;
      }
      if (!window.Accept) {
        reject(new Error("Accept.js is not loaded. Sandbox checkout is unavailable."));
        return;
      }
      window.Accept.dispatchData(
        {
          authData: {
            clientKey: acceptJs.clientKey,
            apiLoginID: acceptJs.apiLoginId,
          },
          cardData: {
            cardNumber: cardNumber.replace(/\s+/g, ""),
            month: cardMonth,
            year: cardYear,
            cardCode,
          },
        },
        (response) => {
          if (response.messages?.resultCode === "Error" || !response.opaqueData?.dataValue) {
            const msg =
              response.messages?.message?.map((m) => m.text).filter(Boolean).join(" ") ||
              "Accept.js tokenization failed.";
            reject(new Error(msg));
            return;
          }
          resolve(
            JSON.stringify({
              dataDescriptor: response.opaqueData.dataDescriptor,
              dataValue: response.opaqueData.dataValue,
            }),
          );
        },
      );
    });
  }

  async function pay(simulateFailure = false) {
    if (!invoice) return;

    // Commas primary: leave OS for hosted secure checkout — never capture cards here.
    if (provider === "commas" && commas?.paymentLinkUrl && !simulateFailure) {
      window.location.href = commas.paymentLinkUrl;
      return;
    }

    setLoading(true);
    setError("");
    try {
      const key = simulateFailure ? `${currentKey}-fail-${Date.now()}` : currentKey;
      const paymentToken =
        simulateFailure
          ? "fail"
          : acceptJs?.enabled
            ? await tokenizeWithAcceptJs()
            : token;
      const res = await fetch("/api/pay/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          paymentToken,
          idempotencyKey: key,
          simulateFailure,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");
      if (data.receipt) {
        setReceipt(data.receipt);
        setContinueUrl(data.continuation?.nextUrl || null);
        setInvoice({
          ...invoice,
          status: data.invoice.status,
          amountPaidCents: data.invoice.amountPaidCents,
        });
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

  async function copyLink() {
    const url = commas?.paymentLinkUrl || `${window.location.origin}/pay/${invoiceNumber}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!invoice && !error) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(245,184,42,0.08),_transparent_55%),linear-gradient(180deg,#040404,#16161a)]">
        <p className="text-[var(--gc-muted)] tracking-[0.2em] uppercase text-xs animate-pulse">
          Preparing secure payment…
        </p>
      </main>
    );
  }

  const shell =
    "min-h-dvh flex items-center justify-center px-5 py-12 bg-[radial-gradient(ellipse_at_top,_rgba(245,184,42,0.09),_transparent_50%),linear-gradient(165deg,#040404_0%,#16161a_45%,#1a1a22_100%)]";

  return (
    <main className={shell}>
      <div className="w-full max-w-lg">
        <div className="gc-fade-up text-center mb-12">
          <p className="text-[0.8rem] tracking-[0.42em] uppercase text-[var(--gc-gold)] mb-4 font-medium">
            Grants &amp; Co
          </p>
          <h1 className="display text-5xl md:text-6xl mb-3 tracking-tight">Secure Payment</h1>
          <p className="text-[var(--gc-text-secondary)] text-sm max-w-sm mx-auto leading-relaxed">
            Private financial concierge · card data never touches Grants &amp; Co servers
          </p>
          <div className="gc-gold-line my-8 mx-auto max-w-[120px]" />
        </div>

        {canceled ? (
          <p className="text-center text-sm text-[var(--gc-warning)] mb-6">
            Payment was canceled. You can try again whenever you are ready.
          </p>
        ) : null}

        {receipt ? (
          <div className="gc-fade-up text-center space-y-5 rounded-[28px] border border-[var(--gc-border)] bg-white/[0.03] px-8 py-12 backdrop-blur-sm">
            <p className="text-[0.7rem] tracking-[0.28em] uppercase text-[var(--gc-success)]">
              Payment Successful
            </p>
            <p className="display text-6xl text-[var(--gc-gold)]">{formatUsd(receipt.amountCents)}</p>
            <p className="text-sm text-[var(--gc-muted)] leading-relaxed">
              {receipt.clientName}
              <br />
              Invoice {receipt.invoiceNumber}
              <br />
              Receipt {receipt.receiptNumber}
            </p>
            <a
              href={continueUrl || `/pay/continue/${receipt.invoiceNumber}`}
              className="gc-btn gc-btn-gold inline-flex mt-6 min-w-[220px] justify-center"
            >
              Continue to Client Setup
            </a>
          </div>
        ) : invoice &&
          (invoice.status === "SUCCEEDED" ||
            invoice.status === "REFUNDED" ||
            invoice.status === "PARTIALLY_REFUNDED") ? (
          <div className="gc-fade-up text-center space-y-4 rounded-[28px] border border-[var(--gc-border)] bg-white/[0.03] px-8 py-12">
            <p className="text-[0.7rem] tracking-[0.2em] uppercase text-[var(--gc-muted)]">
              {invoice.status.replaceAll("_", " ")}
            </p>
            <h2 className="text-3xl display">
              {invoice.client.firstName} {invoice.client.lastName}
            </h2>
            <p className="display text-5xl text-[var(--gc-gold)]">{formatUsd(invoice.amountCents)}</p>
            <p className="text-sm text-[var(--gc-muted)]">Invoice {invoice.invoiceNumber}</p>
            <a
              href={`/pay/continue/${invoice.invoiceNumber}`}
              className="gc-btn gc-btn-gold inline-flex mt-4"
            >
              Continue to Client Setup
            </a>
          </div>
        ) : invoice ? (
          <form
            onSubmit={onSubmit}
            className="gc-fade-up-delay space-y-7 rounded-[28px] border border-[var(--gc-border)] bg-white/[0.03] px-8 py-10 backdrop-blur-sm"
          >
            <div className="text-center space-y-2">
              <p className="text-2xl display tracking-tight">
                {invoice.client.firstName} {invoice.client.lastName}
              </p>
              <p className="text-sm text-[var(--gc-text-secondary)]">{invoice.serviceName}</p>
              <p className="text-[0.65rem] tracking-[0.2em] uppercase text-[var(--gc-muted)] pt-2">
                Invoice {invoice.invoiceNumber}
              </p>
            </div>

            <div className="text-center py-8 border-y border-[var(--gc-border)]">
              <p className="text-[0.65rem] tracking-[0.28em] uppercase text-[var(--gc-muted)] mb-3">
                Amount Due
              </p>
              <p className="display text-6xl text-[var(--gc-gold)]">
                {formatUsd(invoice.amountCents - invoice.amountPaidCents)}
              </p>
            </div>

            {provider === "commas" ? (
              <div className="space-y-3 text-center">
                <p className="text-xs text-[var(--gc-muted)] leading-relaxed">
                  Payment processing is completed securely by Commas.
                  {commas?.enabled
                    ? " You will complete checkout on their protected page."
                    : " Payment link will be available once COMMAS_API_KEY is configured."}
                </p>
                {!commas?.paymentLinkUrl && !commas?.enabled ? (
                  <p className="text-sm text-[var(--gc-warning)]">
                    Commas credentials required — staff can still use mock provider for local QA.
                  </p>
                ) : null}
              </div>
            ) : acceptJs?.enabled ? (
              <div className="space-y-3">
                <p className="text-xs text-[var(--gc-muted)] mb-2">
                  Card details go to Authorize.Net Accept.js only.
                </p>
                <input
                  className="gc-input"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="Card number"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                />
                <div className="grid grid-cols-3 gap-3">
                  <input
                    className="gc-input"
                    inputMode="numeric"
                    autoComplete="cc-exp-month"
                    placeholder="MM"
                    value={cardMonth}
                    onChange={(e) => setCardMonth(e.target.value)}
                  />
                  <input
                    className="gc-input"
                    inputMode="numeric"
                    autoComplete="cc-exp-year"
                    placeholder="YYYY"
                    value={cardYear}
                    onChange={(e) => setCardYear(e.target.value)}
                  />
                  <input
                    className="gc-input"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="CVV"
                    value={cardCode}
                    onChange={(e) => setCardCode(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-[var(--gc-muted)] mb-3 text-center">
                  Development simulator — simulated payments never count as collected revenue.
                </p>
                <input
                  className="gc-input"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Payment token"
                />
              </div>
            )}

            {error && <p className="text-sm text-[var(--gc-danger)] text-center">{error}</p>}

            <button type="submit" className="gc-btn gc-btn-gold w-full text-base py-4" disabled={loading}>
              {loading
                ? "Processing…"
                : provider === "commas"
                  ? "Pay Securely"
                  : "Pay Securely"}
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                className="gc-btn gc-btn-ghost flex-1 text-xs"
                onClick={() => void copyLink()}
              >
                {copied ? "Copied" : "Copy Payment Link"}
              </button>
              {provider !== "commas" && !acceptJs?.enabled ? (
                <button
                  type="button"
                  className="gc-btn gc-btn-ghost flex-1 text-xs"
                  disabled={loading}
                  onClick={() => void pay(true)}
                >
                  Simulate Failure
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="text-center text-[var(--gc-danger)]">{error}</p>
        )}
      </div>
    </main>
  );
}
