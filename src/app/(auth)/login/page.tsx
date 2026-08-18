"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LoginAccessBanner } from "@/components/auth/LoginAccessBanner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to sign in");
      if (data.user.role === "CLIENT") router.push("/portal");
      else router.push("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
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

          <p className="gc-eyebrow text-center mb-3">Private access</p>
          <h1 className="text-center text-4xl md:text-5xl mb-3">Welcome back</h1>
          <p className="text-center text-[var(--gc-muted)] mb-6 text-sm leading-relaxed">
            Sign in to Grants &amp; Co OS — the operating system for Grants &amp; Co Consultants.
          </p>
          <LoginAccessBanner />

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
            <div>
              <label className="block text-[0.7rem] tracking-[0.2em] uppercase text-[var(--gc-muted)] mb-2">
                Password
              </label>
              <input
                className="gc-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-[var(--gc-danger)]">{error}</p>}
            <button type="submit" className="gc-btn gc-btn-primary w-full mt-2" disabled={loading}>
              {loading ? "Signing in…" : "Enter OS"}
            </button>
          </form>
          <p className="text-center text-sm text-[var(--gc-muted)] mt-8">
            <a href="/get" className="text-[var(--gc-gold)]">
              Download desktop OS
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
