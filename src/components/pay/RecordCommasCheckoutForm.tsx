"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function RecordCommasCheckoutForm({
  publicId,
  recordedUrls = [],
}: {
  publicId: string;
  recordedUrls?: string[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [urls, setUrls] = useState(recordedUrls);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (recordedUrls.length > 0) return;
    void fetch("/api/pay/commas-checkouts")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.urls)) setUrls(d.urls as string[]);
      })
      .catch(() => undefined);
  }, [recordedUrls.length]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/api/pay/requests/${encodeURIComponent(publicId)}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not record checkout");
      setMessage("Official Commas checkout recorded.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record checkout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="gc-card space-y-3">
      <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)]">
        Official Commas last step
      </p>
      <p className="text-sm text-[var(--gc-muted)]">
        Fanbasis has no API Keys page. Paste or pick the official checkout / product link. No scrape.
      </p>
      {urls.length > 0 ? (
        <select className="gc-input" value="" onChange={(e) => setUrl(e.target.value)}>
          <option value="">Pick a recorded checkout</option>
          {urls.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      ) : null}
      <input
        className="gc-input"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.fanbasis.com/…"
        required
      />
      <button type="submit" className="gc-btn gc-btn-outline w-full" disabled={busy || !url}>
        {busy ? "Recording…" : "Record official checkout"}
      </button>
      {error ? <p className="text-sm text-[var(--gc-danger)]">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--gc-success)]">{message}</p> : null}
    </form>
  );
}
