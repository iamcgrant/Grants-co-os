"use client";

import { useState } from "react";

export function InvitePortalForm({
  clientId,
  hasPortalUser,
}: {
  clientId: string;
  hasPortalUser: boolean;
}) {
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function invite() {
    setLoading(true);
    setMsg("");
    setSetupUrl(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/portal-invite`, { method: "POST" });
      const data = (await res.json()) as { error?: string; setupUrl?: string; email?: string };
      if (!res.ok) throw new Error(data.error || "Failed");
      setSetupUrl(data.setupUrl || null);
      setMsg(`Portal login ready for ${data.email}. Share the one-time setup link.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gc-card space-y-3">
      <p className="gc-eyebrow">Client portal</p>
      <p className="text-sm text-[var(--gc-muted)]">
        {hasPortalUser
          ? "This client already has a portal user. Send a fresh setup link if they cannot sign in."
          : "Create a /portal login so this client can open their file."}
      </p>
      <button type="button" className="gc-btn gc-btn-outline" onClick={() => void invite()} disabled={loading}>
        {loading ? "Creating…" : hasPortalUser ? "Refresh portal setup link" : "Create portal login"}
      </button>
      {setupUrl ? <p className="text-sm break-all text-[var(--gc-gold)]">{setupUrl}</p> : null}
      {msg ? <p className="text-sm text-[var(--gc-muted)]">{msg}</p> : null}
    </div>
  );
}
