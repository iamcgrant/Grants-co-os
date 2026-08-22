"use client";

import { useEffect, useState } from "react";
import { ComposeMessage } from "@/components/inbox/ComposeMessage";

type Thread = {
  conversationId: string;
  lastMessageBody: string | null;
  lastMessageType: string | null;
  lastMessageAt: string | null;
  channel: "SMS" | "EMAIL" | "CALL" | "OTHER";
};

type DeskMessage = {
  id: string;
  body: string;
  channel: string;
  direction: string | null;
  dateAdded: string | null;
};

type DeskResponse = {
  ready?: boolean;
  failedClosed?: boolean;
  missingScope?: boolean;
  clientId?: string;
  grantsClientId?: string;
  ghlContactId?: string | null;
  osConversationId?: string | null;
  threads?: Thread[];
  messages?: DeskMessage[];
  requiredScope?: string;
  message?: string;
  error?: string;
};

export function GhlClientDesk({
  clientId,
  osConversationId,
  clientName,
}: {
  clientId: string;
  osConversationId?: string;
  clientName?: string;
}) {
  const [desk, setDesk] = useState<DeskResponse | null>(null);
  const [activeThread, setActiveThread] = useState<string>("");
  const [loading, setLoading] = useState(true);

  async function load(conversationId?: string) {
    setLoading(true);
    const params = new URLSearchParams({ clientId });
    if (conversationId) params.set("conversationId", conversationId);
    const res = await fetch(`/api/integrations/ghl/workspace?${params.toString()}`);
    const data = (await res.json()) as DeskResponse;
    setDesk(data);
    if (!conversationId) {
      setActiveThread(data.threads?.[0]?.conversationId || "");
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const conversationId = desk?.osConversationId || osConversationId || "";

  return (
    <div className="flex flex-col min-h-[28rem]">
      <div className="border-b border-[var(--gc-border)] px-4 py-3 flex justify-between gap-3">
        <div>
          <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-ice)]">
            GHL client desk
          </p>
          <p className="font-medium">{clientName || "Client conversation"}</p>
          <p className="text-xs text-[var(--gc-muted)]">
            SMS and email stay in the OS · LeadConnector is the only backend
          </p>
        </div>
        <button type="button" className="gc-btn gc-btn-outline text-xs" onClick={() => void load(activeThread)}>
          Refresh
        </button>
      </div>

      {desk?.failedClosed && (
        <div className="px-4 py-3 text-sm text-[var(--gc-gold)]">
          {desk.message}
          {desk.requiredScope ? ` · Required: ${desk.requiredScope}` : ""}
        </div>
      )}

      <div className="grid md:grid-cols-[220px_1fr] min-h-[22rem]">
        <aside className="border-r border-[var(--gc-border)] divide-y divide-[var(--gc-border)]">
          {(desk?.threads || []).map((thread) => (
            <button
              key={thread.conversationId}
              type="button"
              className={`block w-full text-left px-3 py-3 ${
                activeThread === thread.conversationId ? "bg-white/[0.05]" : ""
              }`}
              onClick={() => {
                setActiveThread(thread.conversationId);
                void load(thread.conversationId);
              }}
            >
              <p className="text-[0.6rem] tracking-[0.12em] uppercase text-[var(--gc-ice)] mb-1">
                {thread.channel}
              </p>
              <p className="text-sm line-clamp-2">{thread.lastMessageBody || "Empty thread"}</p>
            </button>
          ))}
          {!loading && !desk?.threads?.length && (
            <p className="p-3 text-xs text-[var(--gc-muted)]">No GHL threads yet.</p>
          )}
        </aside>
        <div className="flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[rgba(0,0,0,0.15)]">
            {(desk?.messages || []).map((m) => (
              <div key={m.id} className="gc-bubble-client">
                <p className="gc-bubble-label client">
                  {m.direction || "message"} · {m.channel}
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
                <p className="text-[0.65rem] text-[var(--gc-muted)] mt-2">
                  {m.dateAdded ? new Date(m.dateAdded).toLocaleString() : ""}
                </p>
              </div>
            ))}
            {loading && <p className="text-sm text-[var(--gc-muted)]">Loading GHL threads…</p>}
          </div>
          {conversationId && (
            <ComposeMessage
              conversationId={conversationId}
              clientId={desk?.clientId || clientId}
              defaultInternal={false}
              allowClientSend
            />
          )}
        </div>
      </div>
    </div>
  );
}
