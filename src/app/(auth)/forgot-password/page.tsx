"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to send a reset link");
      setMessage(data.message || "If that email belongs to an active account, a reset link is on its way.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send a reset link");
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

          <p className="gc-eyebrow text-center mb-3">Account recovery</p>
          <h1 className="text-center text-4xl md:text-5xl mb-3">Forgot password</h1>
          <p className="text-center text-[var(--gc-muted)] mb-10 text-sm leading-relaxed">
            Enter the email on your Grants &amp; Co OS account. We will send a link to choose a new password.
          </p>

          {message ? (
            <div className="space-y-6 text-center">
              <p className="text-sm leading-relaxed text-[var(--gc-cream)]">{message}</p>
              <Link href="/login" className="gc-btn gc-btn-primary inline-flex">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4 gc-fade-up-delay">
              <div>
                <label className="block text-[0.7rem] tracking-[0.2em] uppercase text-[var(--gc-muted)] mb-2">
                  Email
                </label>
                <input
                  className="gc-input"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-[var(--gc-danger)]">{error}</p>}
              <button type="submit" className="gc-btn gc-btn-primary w-full mt-2" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
              <p className="text-center text-sm">
                <Link href="/login" className="text-[var(--gc-gold)]">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
