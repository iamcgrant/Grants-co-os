"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ComposeMessage({
  conversationId,
  defaultInternal,
  allowClientSend,
}: {
  conversationId: string;
  defaultInternal: boolean;
  allowClientSend: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(defaultInternal || !allowClientSend);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/inbox/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, body, isInternal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setBody("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="border-t border-[var(--gc-border)] p-4 space-y-3">
      {allowClientSend && (
        <div className="flex gap-2">
          <button
            type="button"
            className={`gc-btn text-xs ${isInternal ? "gc-btn-ice" : "gc-btn-outline"}`}
            onClick={() => setIsInternal(true)}
          >
            Internal note
          </button>
          <button
            type="button"
            className={`gc-btn text-xs ${!isInternal ? "gc-btn-gold" : "gc-btn-outline"}`}
            onClick={() => setIsInternal(false)}
          >
            Message client
          </button>
        </div>
      )}
      {!allowClientSend && (
        <p className="text-[0.65rem] tracking-[0.14em] uppercase text-[var(--gc-ice)]">
          Internal only · never sent to client
        </p>
      )}
      <textarea
        className="gc-input min-h-[96px]"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={isInternal ? "Write an internal note…" : "Write a client message…"}
        required
      />
      {error && <p className="text-sm text-[var(--gc-danger)]">{error}</p>}
      <button type="submit" className={`gc-btn ${isInternal ? "gc-btn-primary" : "gc-btn-gold"}`} disabled={loading}>
        {loading ? "Sending…" : isInternal ? "Post internal" : "Send to client"}
      </button>
    </form>
  );
}
