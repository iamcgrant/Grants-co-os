import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LIVE_VERCEL_APP_ORIGIN, PERMANENT_OS_ORIGIN } from "@/lib/access/origins";

export default function PublicAccessPage() {
  return (
    <main className="min-h-dvh gc-app-shell px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <BrandLogo href="/login" size="sm" />
        <p className="gc-eyebrow mt-10 mb-2">Access</p>
        <h1 className="text-4xl md:text-5xl mb-3">How to open Grants &amp; Co OS</h1>
        <p className="gc-section-sub mb-8">
          The website and desktop app both need a live hostname plus a Postgres database.
          Until those two BUILDX steps land, sign-in cannot succeed.
        </p>

        <ol className="space-y-5 mb-10 text-sm leading-relaxed">
          <li>
            <p className="text-[var(--gc-gold)] uppercase tracking-[0.18em] text-[0.7rem] mb-1">
              1 · Open the live site
            </p>
            <p className="text-[var(--gc-muted)]">
              Use{" "}
              <a href={`${LIVE_VERCEL_APP_ORIGIN}/login`} className="text-[var(--gc-gold)]">
                {LIVE_VERCEL_APP_ORIGIN}/login
              </a>
              . The permanent address{" "}
              <a href={`${PERMANENT_OS_ORIGIN}/login`} className="text-[var(--gc-gold)]">
                {PERMANENT_OS_ORIGIN}
              </a>{" "}
              does not resolve until Squarespace has a CNAME for host <code>os</code>.
            </p>
          </li>
          <li>
            <p className="text-[var(--gc-gold)] uppercase tracking-[0.18em] text-[0.7rem] mb-1">
              2 · Database (login blocker)
            </p>
            <p className="text-[var(--gc-muted)]">
              Login reads users from Neon Postgres. The live Vercel project still has no
              <code> postgresql://</code> <code>DATABASE_URL</code>, so sign-in is refused.
              BUILDX must set that Production secret on project{" "}
              <code>temporary-prompt-oboe-st5fuuv</code>, redeploy, then run{" "}
              <code>npm run db:migrate:production</code> and{" "}
              <code>npm run owner:setup-link</code>.
            </p>
          </li>
          <li>
            <p className="text-[var(--gc-gold)] uppercase tracking-[0.18em] text-[0.7rem] mb-1">
              3 · Desktop
            </p>
            <p className="text-[var(--gc-muted)]">
              Installers download from GitHub. After install the current public build opens{" "}
              <code>os.grantandconsultants.com</code>, which has no DNS. Use the website
              login above until a new desktop build with the Vercel fallback is published.
            </p>
          </li>
        </ol>

        <p className="text-sm text-[var(--gc-muted)]">
          <Link href="/login" className="text-[var(--gc-gold)]">
            Staff login
          </Link>
          {" · "}
          <Link href="/get" className="text-[var(--gc-gold)]">
            Download desktop OS
          </Link>
        </p>
      </div>
    </main>
  );
}
