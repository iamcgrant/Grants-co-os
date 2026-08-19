import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  getCanonicalOnlineOrigin,
  isPermanentHostReady,
  LIVE_VERCEL_APP_ORIGIN,
  PERMANENT_OS_ORIGIN,
} from "@/lib/access/origins";

export default function PublicAccessPage() {
  const online = getCanonicalOnlineOrigin();
  const permanentReady = isPermanentHostReady();

  return (
    <main className="min-h-dvh gc-app-shell px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <BrandLogo href="/login" size="sm" />
        <p className="gc-eyebrow mt-10 mb-2">Access</p>
        <h1 className="text-4xl md:text-5xl mb-3">How to open Grants &amp; Co OS</h1>
        <p className="gc-section-sub mb-8">
          Everyday login uses the origin that is actually online. Invites and desktop follow
          that same address so a missing custom-domain CNAME cannot take the OS offline.
        </p>

        <ol className="space-y-5 mb-10 text-sm leading-relaxed">
          <li>
            <p className="text-[var(--gc-gold)] uppercase tracking-[0.18em] text-[0.7rem] mb-1">
              1 · Sign in
            </p>
            <p className="text-[var(--gc-muted)]">
              Open{" "}
              <a href={`${online}/login`} className="text-[var(--gc-gold)]">
                {online}/login
              </a>
              {permanentReady ? null : (
                <>
                  {" "}
                  (live site). {PERMANENT_OS_ORIGIN.replace("https://", "")} stays unused until
                  Squarespace CNAME host <code>os</code> is valid and{" "}
                  <code>GC_PERMANENT_HOST_READY=1</code>.
                </>
              )}
            </p>
          </li>
          <li>
            <p className="text-[var(--gc-gold)] uppercase tracking-[0.18em] text-[0.7rem] mb-1">
              2 · Invite employees
            </p>
            <p className="text-[var(--gc-muted)]">
              Owner/Admin → Team logins. Each invite creates a staff user and a one-time
              password link on this same online origin.
            </p>
          </li>
          <li>
            <p className="text-[var(--gc-gold)] uppercase tracking-[0.18em] text-[0.7rem] mb-1">
              3 · Client portal
            </p>
            <p className="text-[var(--gc-muted)]">
              On a client 360, use Create portal login. The client sets a password and opens{" "}
              <code>/portal</code>.
            </p>
          </li>
        </ol>

        <p className="text-sm text-[var(--gc-muted)]">
          <Link href="/login" className="text-[var(--gc-gold)]">
            Staff login
          </Link>
          {" · "}
          <a href={`${LIVE_VERCEL_APP_ORIGIN}/login`} className="text-[var(--gc-gold)]">
            Vercel backup
          </a>
          {" · "}
          <Link href="/get" className="text-[var(--gc-gold)]">
            Download desktop OS
          </Link>
        </p>
      </div>
    </main>
  );
}
