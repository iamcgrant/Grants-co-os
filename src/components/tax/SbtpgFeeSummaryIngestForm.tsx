"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function SbtpgFeeSummaryIngestForm({
  heading = "Official Fee Summary",
  description = "Persist the staff-captured 2026-08-22 TY 2026 Fee Summary from pro.sbtpg.com (PAID $117,700.00 / 73, UNFUNDED $21,000.00 / 12, FCA $0, Auto Collect $0). No scrape. No invented daily split.",
  successMessage = "Official TY 2026 Fee Summary PAID $117,700.00 / 73 taxpayers is now in Postgres. Command Center Total Revenue reads that snapshot.",
}: {
  heading?: string;
  description?: string;
  successMessage?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function ingestOfficial(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/tax/sbtpg/fee-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingestCaptured: "2026-08-22" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not persist official Fee Summary");
      setMessage(successMessage);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not persist official Fee Summary");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={ingestOfficial} className="gc-card space-y-3" data-official-fee-summary-persist>
      <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)]">
        {heading}
      </p>
      <p className="text-sm text-[var(--gc-muted)]">
        {description}
      </p>
      <button type="submit" className="gc-btn gc-btn-gold text-xs" disabled={busy}>
        {busy ? "Saving…" : "Persist official TY 2026 Fee Summary"}
      </button>
      {message ? <p className="text-sm text-[var(--gc-gold)]">{message}</p> : null}
    </form>
  );
}
