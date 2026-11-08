"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { pathAfterLogin } from "@/lib/auth/return-to";

export function LoginForm({ returnTo }: { returnTo: string | null }) {
  const router = useRouter();
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("username") || "");
    const password = String(data.get("password") || "");
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to sign in");
      router.push(pathAfterLogin(data.user.role, returnTo));
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
          <p className="text-center text-[var(--gc-muted)] mb-10 text-sm leading-relaxed">
            Sign in to Grants &amp; Co OS — the operating system for Grants &amp; Co Consultants.
          </p>

          <form
            onSubmit={onSubmit}
            method="post"
            action="/api/auth/login"
            autoComplete="on"
            className="space-y-4 gc-fade-up-delay"
          >
            {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
            <div>
              <label
                htmlFor="username"
                className="block text-[0.7rem] tracking-[0.2em] uppercase text-[var(--gc-muted)] mb-2"
              >
                Email
              </label>
              <input
                id="username"
                className="gc-input"
                type="email"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                required
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="password"
                  className="block text-[0.7rem] tracking-[0.2em] uppercase text-[var(--gc-muted)]"
                >
                  Password
                </label>
                <Link href="/forgot-password" className="text-sm text-[var(--gc-gold)]">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                className="gc-input gc-input-password"
                type="password"
                name="password"
                autoComplete="current-password"
                enterKeyHint="go"
                required
              />
            </div>
            <label className="flex items-center gap-3 text-sm text-[var(--gc-muted)] pt-1">
              <input
                type="checkbox"
                name="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="size-4 accent-[var(--gc-gold)]"
              />
              Remember me and stay signed in
            </label>
            {error && <p className="text-sm text-[var(--gc-danger)]">{error}</p>}
            <button type="submit" className="gc-btn gc-btn-primary w-full mt-2" disabled={loading}>
              {loading ? "Signing in…" : "Enter OS"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
