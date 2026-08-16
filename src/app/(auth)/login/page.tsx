"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@grantsandco.com");
  const [password, setPassword] = useState("GrantsCo2026!");
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
      if (!res.ok) throw new Error(data.error || "Login failed");
      if (data.user.role === "CLIENT") router.push("/portal");
      else router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md gc-fade-up">
        <p className="gc-eyebrow mb-4">
          Grants &amp; Co
        </p>
        <h1 className="text-5xl md:text-6xl leading-none mb-3 text-white">
          OS
        </h1>
        <p className="text-[var(--gc-muted)] mb-10 text-sm leading-relaxed max-w-sm">
          Secure access to the Grants &amp; Co operating system.
        </p>

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
          {error && (
            <p className="text-sm text-[var(--gc-danger)]">{error}</p>
          )}
          <button
            type="submit"
            className="gc-btn gc-btn-gold w-full mt-2"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Enter"}
          </button>
        </form>

        <p className="mt-8 text-xs text-[var(--gc-muted)] gc-fade-up-delay-2">
          Demo: owner@grantsandco.com · GrantsCo2026!
        </p>
      </div>
    </main>
  );
}
