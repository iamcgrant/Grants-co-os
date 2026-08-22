"use client";

import { useEffect, useState } from "react";
import { OfficialLoginLink } from "@/components/desk/OfficialLoginLink";
import { OFFICIAL_GHL_LOGIN_URL } from "@/lib/nav/official-login-urls";

type VoiceStatus = {
  ready?: boolean;
  status?: string;
  numbers?: Array<{ id: string; phone: string; label?: string }>;
  requiredScope?: string;
  message?: string;
};

export function DialerWorkspace({
  initialTo,
  contactId,
}: {
  initialTo?: string;
  contactId?: string;
}) {
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [digits, setDigits] = useState(initialTo || "");
  const [fromNumber, setFromNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  async function load() {
    const res = await fetch("/api/integrations/ghl/voice");
    const data = (await res.json()) as VoiceStatus;
    setStatus(data);
    if (!fromNumber && data.numbers?.[0]?.phone) setFromNumber(data.numbers[0].phone);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function press(value: string) {
    setDigits((prev) => `${prev}${value}`.slice(0, 16));
  }

  async function placeCall() {
    setBusy(true);
    setResult("");
    try {
      const res = await fetch("/api/integrations/ghl/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toE164: digits, fromNumber, contactId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(data.error || "Call failed");
      } else {
        setResult(`Connected · session ${data.sessionId}`);
      }
    } finally {
      setBusy(false);
    }
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

  return (
    <div className="gc-card max-w-md mx-auto space-y-5">
      <div>
        <p className="gc-eyebrow mb-1">LeadConnector voice</p>
        <p className="text-lg display">In-OS dialer</p>
        <p className="text-sm text-[var(--gc-muted)] mt-1">
          Uses existing GHL numbers only. No Twilio or Telnyx.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className={`gc-status ${status?.ready ? "gc-status-ok" : "gc-status-warn"}`}>
          {status?.ready ? "Session ready" : "Action required"}
        </span>
        {status?.requiredScope && (
          <span className="text-[0.65rem] text-[var(--gc-gold)]">{status.requiredScope}</span>
        )}
      </div>
      {status?.message && <p className="text-sm text-[var(--gc-muted)]">{status.message}</p>}
      {!status?.ready ? (
        <OfficialLoginLink href={OFFICIAL_GHL_LOGIN_URL} />
      ) : null}

      {!!status?.numbers?.length && (
        <label className="block text-sm">
          <span className="text-[var(--gc-muted)]">From GHL number</span>
          <select
            className="gc-input mt-1"
            value={fromNumber}
            onChange={(e) => setFromNumber(e.target.value)}
          >
            {status.numbers.map((n) => (
              <option key={n.id} value={n.phone}>
                {n.label ? `${n.label} · ${n.phone}` : n.phone}
              </option>
            ))}
          </select>
        </label>
      )}

      <input
        className="gc-input text-center text-2xl tracking-[0.18em]"
        value={digits}
        onChange={(e) => setDigits(e.target.value)}
        placeholder="Enter number"
      />

      <div className="grid grid-cols-3 gap-2">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            className="gc-btn gc-btn-outline text-xl h-14"
            onClick={() => press(key)}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="gc-btn gc-btn-outline flex-1"
          onClick={() => setDigits((prev) => prev.slice(0, -1))}
        >
          Delete
        </button>
        <button
          type="button"
          className="gc-btn gc-btn-gold flex-1"
          onClick={() => void placeCall()}
          disabled={busy || !digits.trim()}
        >
          {busy ? "Calling…" : "Call"}
        </button>
      </div>
      {result && <p className="text-sm text-[var(--gc-gold)]">{result}</p>}
    </div>
  );
}
