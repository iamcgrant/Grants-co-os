import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { getDesktopDownloadLinks } from "@/lib/desktop/downloads";

export default function PublicDesktopDownloadPage() {
  const links = getDesktopDownloadLinks();
  const platforms = [
    { id: "mac", label: "macOS", url: links.macUrl, detail: "Apple Silicon .dmg" },
    { id: "win", label: "Windows", url: links.winUrl, detail: "NSIS installer" },
    { id: "linux", label: "Linux", url: links.linuxUrl, detail: "AppImage" },
  ] as const;

  return (
    <main className="min-h-dvh gc-app-shell px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <BrandLogo href="/login" size="sm" />
        <p className="gc-eyebrow mt-10 mb-2">Desktop</p>
        <h1 className="text-4xl md:text-5xl mb-3">Download Grants &amp; Co OS</h1>
        <p className="gc-section-sub mb-8 max-w-2xl">
          Native shell for the same production app. No server secrets are bundled. Sign in after
          install at os.grantandconsultants.com.
        </p>
        <div className="grid gap-4 md:grid-cols-3 mb-10">
          {platforms.map((p) => (
            <div key={p.id} className="gc-card flex flex-col">
              <p className="gc-eyebrow mb-2">{p.label}</p>
              <p className="text-sm text-[var(--gc-muted)] mb-5 flex-1">{p.detail}</p>
              {p.url ? (
                <a
                  href={p.url}
                  className="gc-btn gc-btn-gold text-center text-sm py-2.5"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download
                </a>
              ) : (
                <span className="text-xs uppercase tracking-widest text-[var(--gc-muted)]">Coming soon</span>
              )}
            </div>
          ))}
        </div>
        <p className="text-sm text-[var(--gc-muted)]">
          <Link href="/login" className="text-[var(--gc-gold)]">
            Staff login
          </Link>
          {links.releasesPageUrl ? (
            <>
              {" · "}
              <a href={links.releasesPageUrl} className="text-[var(--gc-gold)]" target="_blank" rel="noreferrer">
                All releases
              </a>
            </>
          ) : null}
        </p>
      </div>
    </main>
  );
}
