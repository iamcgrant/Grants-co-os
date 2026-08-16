"use client";

import { useState } from "react";

export function ApprovalCard({
  approval,
}: {
  approval: {
    id: string;
    title: string;
    what: string;
    why: string;
    risk: string;
    agent?: { displayName: string } | null;
  };
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function decide(decision: "APPROVED" | "DENIED") {
    setBusy(true);
    try {
      const res = await fetch("/api/agent-hub/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId: approval.id, decision }),
      });
      if (res.ok) setDone(decision);
      else setDone("ERROR");
    } finally {
      setBusy(false);
    }
  }

  if (done === "APPROVED" || done === "DENIED") {
    return (
      <div className="gc-card">
        <p className="text-sm">{approval.title}</p>
        <p className="gc-status mt-2">{done}</p>
      </div>
    );
  }

  return (
    <div className="gc-card space-y-3 border border-[var(--gc-gold)]/40">
      <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-gold)]">Owner approval</p>
      <p className="font-medium">{approval.title}</p>
      <div className="text-sm space-y-2">
        <p>
          <span className="text-[var(--gc-muted)]">What · </span>
          {approval.what}
        </p>
        <p>
          <span className="text-[var(--gc-muted)]">Why · </span>
          {approval.why}
        </p>
        <p>
          <span className="text-[var(--gc-muted)]">Agent · </span>
          {approval.agent?.displayName || "—"}
        </p>
        <p>
          <span className="text-[var(--gc-muted)]">Risk · </span>
          {approval.risk}
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" className="gc-btn gc-btn-gold text-xs" disabled={busy} onClick={() => decide("APPROVED")}>
          Approve
        </button>
        <button type="button" className="gc-btn gc-btn-outline text-xs" disabled={busy} onClick={() => decide("DENIED")}>
          Deny
        </button>
      </div>
    </div>
  );
}
