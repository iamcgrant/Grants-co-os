"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CognitoPullForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/tax/cognito/pull", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not pull Cognito Forms");
      setMessage(`Pulled ${data.submissions?.length ?? 0} submissions from ${data.formCount ?? 0} forms`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not pull Cognito Forms");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="gc-card max-w-xl space-y-3">
      <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)]">Official API pull</p>
      <p className="text-sm text-[var(--gc-muted)]">
        Lists submitted tax/client forms via the official Cognito Forms API. Requires COGNITO_API_KEY. No scrape.
      </p>
      <button type="submit" className="gc-btn gc-btn-gold text-xs" disabled={busy}>
        {busy ? "Pulling…" : "Pull submissions"}
      </button>
      {message ? <p className="text-sm text-[var(--gc-gold)]">{message}</p> : null}
    </form>
  );
}
