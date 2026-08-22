"use client";

import { useEffect, useState } from "react";
import { OfficialLoginLink } from "@/components/desk/OfficialLoginLink";
import { GMAIL_WORK_MAILBOX, OFFICIAL_GMAIL_LOGIN_URL } from "@/lib/nav/official-login-urls";

type Mail = {
  id: string;
  from: string | null;
  subject: string | null;
  snippet: string | null;
  date: string | null;
};

type InboxResponse = {
  ready?: boolean;
  failedClosed?: boolean;
  messages?: Mail[];
  mailbox?: string;
  message?: string;
  requiredEnv?: string[];
  error?: string;
};

export function GmailWorkInbox() {
  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/integrations/gmail/inbox");
    const json = (await res.json()) as InboxResponse;
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="gc-panel !p-0 overflow-hidden min-h-[68vh]">
      <div className="px-4 py-3 border-b border-[var(--gc-border)] flex justify-between gap-3">
        <div>
          <p className="gc-eyebrow mb-1">Work Gmail</p>
          <p className="font-medium">
            {data?.mailbox && data.mailbox !== "me" ? data.mailbox : GMAIL_WORK_MAILBOX}
          </p>
          <p className="text-xs text-[var(--gc-muted)]">Official Gmail API · no scrape · GMAIL_* only</p>
        </div>
        <button type="button" className="gc-btn gc-btn-outline text-xs" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {(data?.failedClosed || data?.error) && (
        <p className="px-4 py-3 text-sm text-[var(--gc-gold)]">
          {data.error || data.message}
          {data.requiredEnv?.length ? ` · Set ${data.requiredEnv.join(", ")}` : ""}
        </p>
      )}
      <div className="divide-y divide-[var(--gc-border)]">
        {(data?.messages || []).map((mail) => (
          <div key={mail.id} className="px-4 py-4">
            <p className="font-medium text-sm">{mail.subject || "(no subject)"}</p>
            <p className="text-xs text-[var(--gc-muted)] mt-1">{mail.from}</p>
            <p className="text-sm text-[var(--gc-muted)] mt-2">{mail.snippet}</p>
            {mail.date ? <p className="text-[0.6rem] text-[var(--gc-muted)] mt-2">{mail.date}</p> : null}
          </div>
        ))}
        {!loading && !data?.messages?.length && (
          <div className="p-4 space-y-3">
            <p className="text-sm text-[var(--gc-muted)]">
              {data?.message || "Work Gmail is empty or waiting on GMAIL_* credentials."}
            </p>
            <OfficialLoginLink href={OFFICIAL_GMAIL_LOGIN_URL} />
          </div>
        )}
        {loading && <p className="p-4 text-sm text-[var(--gc-muted)]">Loading Gmail…</p>}
      </div>
    </div>
  );
}
