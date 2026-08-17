"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Prefill = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  grantsClientId?: string;
};

type SetupPayload = {
  valid: boolean;
  error?: string;
  prefill?: Prefill;
  serviceName?: string | null;
  grantsClientId?: string;
  alreadyComplete?: boolean;
};

/**
 * Native Grants & Co Client Setup — luxury post-payment intake.
 * Prefills known master identity fields. Maps into DisputeFox when template configured.
 */
export default function ClientSetupPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;
  const [data, setData] = useState<SetupPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    dateOfBirth: "",
    ssnLast4: "",
    goals: "",
    monitoringPreference: "smartcredit",
  });

  useEffect(() => {
    void fetch(`/api/setup/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d: SetupPayload) => {
        setData(d);
        if (d.prefill) {
          setForm((f) => ({
            ...f,
            firstName: d.prefill?.firstName || "",
            lastName: d.prefill?.lastName || "",
            email: d.prefill?.email || "",
            phone: d.prefill?.phone || "",
          }));
        }
        if (d.alreadyComplete) setDone(true);
        if (!d.valid && d.error) setError(d.error);
      });
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/setup/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Setup failed");
      setDone(true);
      setHandoffUrl(json.disputeFoxUrl || json.portalUrl || "/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh px-5 py-12 bg-[radial-gradient(ellipse_at_top,_rgba(245,184,42,0.08),_transparent_50%),linear-gradient(165deg,#040404,#16161a)]">
      <div className="mx-auto max-w-xl">
        <div className="text-center mb-10 gc-fade-up">
          <p className="text-[0.75rem] tracking-[0.4em] uppercase text-[var(--gc-gold)] mb-3">
            Grants &amp; Co
          </p>
          <h1 className="display text-4xl md:text-5xl mb-3">Welcome</h1>
          <p className="text-[var(--gc-text-secondary)] text-sm leading-relaxed">
            Your payment has been confirmed. Let&apos;s get your file started.
          </p>
        </div>

        {done ? (
          <div className="rounded-[28px] border border-[var(--gc-border)] bg-white/[0.03] px-8 py-12 text-center space-y-4">
            <p className="text-[0.7rem] tracking-[0.24em] uppercase text-[var(--gc-success)]">
              Setup Received
            </p>
            <p className="text-lg text-[var(--gc-text-secondary)]">
              Your Grants &amp; Co file is ready for our team.
            </p>
            <button
              type="button"
              className="gc-btn gc-btn-gold"
              onClick={() => router.push(handoffUrl || "/portal")}
            >
              Continue
            </button>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="rounded-[28px] border border-[var(--gc-border)] bg-white/[0.03] px-6 py-8 space-y-4"
          >
            {data?.grantsClientId ? (
              <p className="text-center text-[0.65rem] tracking-[0.18em] uppercase text-[var(--gc-muted)] mb-2">
                Client {data.grantsClientId}
                {data.serviceName ? ` · ${data.serviceName}` : ""}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <input
                className="gc-input"
                placeholder="First name"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
              <input
                className="gc-input"
                placeholder="Last name"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
            <input
              className="gc-input"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <input
              className="gc-input"
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <input
              className="gc-input"
              placeholder="Street address"
              value={form.addressLine1}
              onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                className="gc-input"
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
              <input
                className="gc-input"
                placeholder="State"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
              <input
                className="gc-input"
                placeholder="ZIP"
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                className="gc-input"
                placeholder="Date of birth (YYYY-MM-DD)"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              />
              <input
                className="gc-input"
                placeholder="SSN last 4"
                inputMode="numeric"
                maxLength={4}
                value={form.ssnLast4}
                onChange={(e) => setForm({ ...form, ssnLast4: e.target.value.replace(/\D/g, "") })}
              />
            </div>
            <textarea
              className="gc-input min-h-[100px]"
              placeholder="What would you like us to prioritize?"
              value={form.goals}
              onChange={(e) => setForm({ ...form, goals: e.target.value })}
            />
            <select
              className="gc-input"
              value={form.monitoringPreference}
              onChange={(e) => setForm({ ...form, monitoringPreference: e.target.value })}
            >
              <option value="smartcredit">SmartCredit monitoring</option>
              <option value="credit_karma">Credit Karma assisted updates</option>
              <option value="both">Both</option>
            </select>

            {error ? <p className="text-sm text-[var(--gc-danger)] text-center">{error}</p> : null}

            <button type="submit" className="gc-btn gc-btn-gold w-full py-4" disabled={loading || !data?.valid}>
              {loading ? "Saving…" : "Start My File"}
            </button>
            <p className="text-[0.65rem] text-center text-[var(--gc-muted)] leading-relaxed">
              One master client record · duplicate submissions update the same file
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
