"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { BrandLogo } from "@/components/brand/BrandLogo";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!token) {
        setError("Missing setup token. Open the full link you were given.");
        setChecking(false);
        return;
      }
      try {
        const res = await fetch(`/api/auth/set-password?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.valid) {
          setError(data.error || "This setup link is invalid or expired.");
          setValid(false);
        } else {
          setValid(true);
          setEmail(data.email || "");
          setFirstName(data.firstName || "");
        }
      } catch {
        if (!cancelled) setError("Unable to validate setup link.");
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to set password");
      router.push("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to set password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/brand/hero-atmosphere.jpg"
          alt=""
          fill
          priority
          className="object-cover opacity-45"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(0deg, #16161a 8%, rgba(4,4,4,0.55) 55%, rgba(4,4,4,0.35) 100%)",
          }}
        />
      </div>

      <div className="relative z-10 min-h-dvh flex flex-col items-center justify-center px-6 py-14">
        <div className="w-full max-w-md gc-fade-up">
          <div className="mb-10 flex justify-center">
            <BrandLogo href={null} size="lg" />
          </div>

          <p className="gc-eyebrow text-center mb-3">Owner access</p>
          <h1 className="text-center text-4xl md:text-5xl mb-3">Set your password</h1>
          <p className="text-center text-[var(--gc-muted)] mb-10 text-sm leading-relaxed">
            {firstName
              ? `Welcome, ${firstName}. Choose a strong password for your Owner account.`
              : "Choose a strong password for your Owner account."}
          </p>

          {checking && (
            <p className="text-center text-sm text-[var(--gc-muted)]">Validating setup link…</p>
          )}

          {!checking && !valid && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-[var(--gc-danger)]">{error || "Setup link unavailable."}</p>
              <a href="/login" className="gc-btn gc-btn-primary inline-flex">
                Go to login
              </a>
            </div>
          )}

          {!checking && valid && (
            <form onSubmit={onSubmit} className="space-y-4 gc-fade-up-delay">
              <div>
                <label className="block text-[0.7rem] tracking-[0.2em] uppercase text-[var(--gc-muted)] mb-2">
                  Email
                </label>
                <input className="gc-input" type="email" value={email} readOnly disabled />
              </div>
              <div>
                <label className="block text-[0.7rem] tracking-[0.2em] uppercase text-[var(--gc-muted)] mb-2">
                  New password
                </label>
                <input
                  className="gc-input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={12}
                />
                <p className="mt-2 text-xs text-[var(--gc-muted)]">
                  At least 12 characters, with upper, lower, number, and symbol.
                </p>
              </div>
              <div>
                <label className="block text-[0.7rem] tracking-[0.2em] uppercase text-[var(--gc-muted)] mb-2">
                  Confirm password
                </label>
                <input
                  className="gc-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={12}
                />
              </div>
              {error && <p className="text-sm text-[var(--gc-danger)]">{error}</p>}
              <button type="submit" className="gc-btn gc-btn-primary w-full mt-2" disabled={loading}>
                {loading ? "Saving…" : "Set password & enter OS"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh flex items-center justify-center text-[var(--gc-muted)]">
          Loading…
        </main>
      }
    >
      <SetPasswordForm />
    </Suspense>
  );
}
