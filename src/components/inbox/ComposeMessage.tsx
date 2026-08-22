"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ClientChannel = "SMS" | "EMAIL";

export function ComposeMessage({
  conversationId,
  clientId,
  defaultInternal,
  allowClientSend,
}: {
  conversationId: string;
  clientId?: string;
  defaultInternal: boolean;
  allowClientSend: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [isInternal, setIsInternal] = useState(defaultInternal || !allowClientSend);
  const [channel, setChannel] = useState<ClientChannel>("SMS");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scopeHint, setScopeHint] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    setError("");
    setScopeHint("");
    try {
      if (!isInternal && clientId) {
        const res = await fetch("/api/integrations/ghl/workspace/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            channel: channel === "EMAIL" ? "Email" : "SMS",
            body,
            subject: channel === "EMAIL" ? subject : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setScopeHint(typeof data.requiredScope === "string" ? data.requiredScope : "");
          throw new Error(data.error || "Send failed");
        }
      } else {
        const res = await fetch("/api/inbox/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            body,
            isInternal,
            channel: isInternal ? "INTERNAL" : channel,
            subject: channel === "EMAIL" ? subject : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Send failed");
      }
      setBody("");
      setSubject("");
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`gc-btn text-xs ${isInternal ? "gc-btn-ice" : "gc-btn-outline"}`}
            onClick={() => setIsInternal(true)}
          >
            Internal note
          </button>
          <button
            type="button"
            className={`gc-btn text-xs ${!isInternal && channel === "SMS" ? "gc-btn-gold" : "gc-btn-outline"}`}
            onClick={() => {
              setIsInternal(false);
              setChannel("SMS");
            }}
          >
            SMS
          </button>
          <button
            type="button"
            className={`gc-btn text-xs ${!isInternal && channel === "EMAIL" ? "gc-btn-gold" : "gc-btn-outline"}`}
            onClick={() => {
              setIsInternal(false);
              setChannel("EMAIL");
            }}
          >
            Email
          </button>
        </div>
      )}
      {!allowClientSend && (
        <p className="text-[0.65rem] tracking-[0.14em] uppercase text-[var(--gc-ice)]">
          Internal only · never sent to client
        </p>
      )}
      {!isInternal && channel === "EMAIL" && (
        <input
          className="gc-input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject"
        />
      )}
      <textarea
        className="gc-input min-h-[96px]"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          isInternal
            ? "Write an internal note…"
            : channel === "EMAIL"
              ? "Write an email via GHL…"
              : "Write an SMS via GHL…"
        }
        required
      />
      {error && <p className="text-sm text-[var(--gc-danger)]">{error}</p>}
      {scopeHint && (
        <p className="text-xs text-[var(--gc-gold)]">Required GHL scope: {scopeHint}</p>
      )}
      <button type="submit" className={`gc-btn ${isInternal ? "gc-btn-primary" : "gc-btn-gold"}`} disabled={loading}>
        {loading
          ? "Sending…"
          : isInternal
            ? "Post internal"
            : channel === "EMAIL"
              ? "Send email"
              : "Send SMS"}
      </button>
    </form>
  );
}
