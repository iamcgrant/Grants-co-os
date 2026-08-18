"use client";

import { useState } from "react";

const ROLES = [
  { value: "CUSTOMER_SERVICE", label: "Client Care" },
  { value: "FILE_PREPARER", label: "File Preparation" },
  { value: "MANAGER", label: "Manager" },
  { value: "MARKETING", label: "Marketing" },
  { value: "ADMIN", label: "Administrator" },
] as const;

export function InviteStaffForm() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]["value"]>("CUSTOMER_SERVICE");
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function invite() {
    setLoading(true);
    setMsg("");
    setSetupUrl(null);
    try {
      const res = await fetch("/api/staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName, role }),
      });
      const data = (await res.json()) as { error?: string; setupUrl?: string; email?: string };
      if (!res.ok) throw new Error(data.error || "Failed");
      setSetupUrl(data.setupUrl || null);
      setMsg(`Invite created for ${data.email}. Share the one-time setup link.`);
      setEmail("");
      setFirstName("");
      setLastName("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gc-panel p-5 space-y-3">
      <p className="gc-eyebrow">Invite employee</p>
      <div className="grid gap-3 md:grid-cols-2">
        <input
          className="gc-search"
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <input
          className="gc-search"
          placeholder="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
        <input
          className="gc-search"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select
          className="gc-search"
          value={role}
          onChange={(e) => setRole(e.target.value as (typeof ROLES)[number]["value"])}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <button type="button" className="gc-btn gc-btn-outline" onClick={() => void invite()} disabled={loading}>
        {loading ? "Creating…" : "Create login + setup link"}
      </button>
      {setupUrl ? (
        <p className="text-sm break-all text-[var(--gc-gold)]">{setupUrl}</p>
      ) : null}
      {msg ? <p className="text-sm text-[var(--gc-muted)]">{msg}</p> : null}
    </div>
  );
}
