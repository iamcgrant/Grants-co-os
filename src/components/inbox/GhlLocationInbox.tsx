"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OfficialLoginLink } from "@/components/desk/OfficialLoginLink";
import { OFFICIAL_GHL_LOGIN_URL } from "@/lib/nav/official-login-urls";

type Thread = {
  conversationId: string;
  contactId: string | null;
  lastMessageBody: string | null;
  lastMessageType: string | null;
  lastMessageDirection: string | null;
  lastMessageAt: string | null;
  channel: string;
  grantsClientId: string | null;
  clientName: string | null;
  clientId: string | null;
};

type InboxResponse = {
  ready?: boolean;
  failedClosed?: boolean;
  threads?: Thread[];
  message?: string;
  requiredSecrets?: string[];
  requiredScope?: string;
  error?: string;
};

export function GhlLocationInbox() {
  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/integrations/ghl/conversations");
    const json = (await res.json()) as InboxResponse;
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="gc-panel !p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--gc-border)] flex justify-between gap-3">
        <div>
          <p className="gc-eyebrow mb-1">GoHighLevel</p>
          <p className="font-medium">Location inbox</p>
        </div>
        <button type="button" className="gc-btn gc-btn-outline text-xs" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {(data?.failedClosed || data?.error) && (
        <p className="px-4 py-3 text-sm text-[var(--gc-gold)]">
          {data.error || data.message}
          {data.requiredScope ? ` · ${data.requiredScope}` : ""}
        </p>
      )}
      <div className="divide-y divide-[var(--gc-border)] max-h-[70vh] overflow-y-auto">
        {(data?.threads || []).map((thread) => (
          <div key={thread.conversationId} className="px-4 py-3.5 flex justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {thread.clientName || thread.contactId || "Unlinked GHL contact"}
              </p>
              <p className="text-xs text-[var(--gc-muted)] line-clamp-2">
                {thread.lastMessageBody || "No preview"}
              </p>
              <p className="text-[0.6rem] text-[var(--gc-muted)] mt-1">
                {thread.channel}
                {thread.lastMessageAt ? ` · ${new Date(thread.lastMessageAt).toLocaleString()}` : ""}
              </p>
            </div>
            {thread.grantsClientId ? (
              <Link href={`/inbox?tab=ghl&client=${thread.grantsClientId}`} className="gc-status gc-status-ice">
                Open desk
              </Link>
            ) : (
              <span className="gc-status gc-status-warn">Link master</span>
            )}
          </div>
        ))}
        {!loading && !data?.threads?.length && (
          <div className="p-4 space-y-3">
            <p className="text-sm text-[var(--gc-muted)]">
              {data?.message || "No GHL conversations yet. Pull conversations or confirm GHL_API_KEY."}
            </p>
            <OfficialLoginLink href={OFFICIAL_GHL_LOGIN_URL} />
          </div>
        )}
        {loading && <p className="p-4 text-sm text-[var(--gc-muted)]">Loading GHL conversations…</p>}
      </div>
    </div>
  );
}
