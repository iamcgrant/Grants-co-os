"use client";

import { FormEvent, useEffect, useState } from "react";

type Chat = {
  id: string;
  title: string;
  type: string;
  lastMessage?: string;
};

type TeamMessage = {
  id: string;
  body: string;
  from: string;
  date: string;
  outgoing: boolean;
};

export function TelegramTeamInbox() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState("");
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [notice, setNotice] = useState("Loading team chats…");
  const [requiredEnv, setRequiredEnv] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadChats() {
    const res = await fetch("/api/integrations/telegram/chats");
    const data = await res.json();
    setChats(data.chats || []);
    setNotice(data.message || "");
    setRequiredEnv(data.requiredEnv || "");
    if (!active && data.chats?.[0]?.id) {
      setActive(data.chats[0].id);
    }
  }

  async function loadMessages(chatId: string) {
    if (!chatId) return;
    const res = await fetch(`/api/integrations/telegram/messages?chatId=${encodeURIComponent(chatId)}`);
    const data = await res.json();
    setMessages(data.messages || []);
    if (data.message && !data.ready) setNotice(data.message);
  }

  useEffect(() => {
    void loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (active) void loadMessages(active);
  }, [active]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!active || !body.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/integrations/telegram/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: active, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setBody("");
      await loadMessages(active);
      await loadChats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-4 min-h-[68vh]">
      <aside className="gc-panel !p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--gc-border)]">
          <p className="gc-eyebrow mb-1">Telegram</p>
          <p className="font-medium">Team chats</p>
        </div>
        <div className="divide-y divide-[var(--gc-border)]">
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              className={`block w-full text-left px-4 py-3 ${active === chat.id ? "bg-white/[0.05]" : ""}`}
              onClick={() => setActive(chat.id)}
            >
              <p className="text-sm font-medium truncate">{chat.title}</p>
              <p className="text-xs text-[var(--gc-muted)] line-clamp-2">
                {chat.lastMessage || chat.type}
              </p>
            </button>
          ))}
          {!chats.length && (
            <p className="p-4 text-sm text-[var(--gc-muted)]">
              {notice || "No team chats visible yet."}
            </p>
          )}
        </div>
      </aside>

      <section className="gc-panel flex flex-col min-h-[68vh] overflow-hidden !p-0">
        <div className="border-b border-[var(--gc-border)] px-4 py-3">
          <p className="font-medium">
            {chats.find((c) => c.id === active)?.title || "Team inbox"}
          </p>
          <p className="text-xs text-[var(--gc-muted)]">
            Staff only · never routed through GHL
          </p>
        </div>
        {(notice || requiredEnv) && (
          <div className="px-4 py-3 text-sm text-[var(--gc-gold)]">
            {notice}
            {requiredEnv ? ` · Set ${requiredEnv}` : ""}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[rgba(0,0,0,0.15)]">
          {messages.map((m) => (
            <div key={m.id} className={m.outgoing ? "gc-bubble-internal" : "gc-bubble-client"}>
              <p className={`gc-bubble-label ${m.outgoing ? "internal" : "client"}`}>
                {m.from}
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
              <p className="text-[0.65rem] text-[var(--gc-muted)] mt-2">
                {new Date(m.date).toLocaleString()}
              </p>
            </div>
          ))}
          {!messages.length && (
            <p className="text-sm text-[var(--gc-muted)]">
              Select a team chat. Messages appear here after the bot can read the thread.
            </p>
          )}
        </div>
        <form onSubmit={onSend} className="border-t border-[var(--gc-border)] p-4 space-y-3">
          <textarea
            className="gc-input min-h-[88px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message Simon / CS / disputes…"
          />
          {error && <p className="text-sm text-[var(--gc-danger)]">{error}</p>}
          <button type="submit" className="gc-btn gc-btn-gold" disabled={busy || !active}>
            {busy ? "Sending…" : "Send to Telegram"}
          </button>
        </form>
      </section>
    </div>
  );
}
