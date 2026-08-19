import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDesktopDownloadLinks } from "@/lib/desktop/downloads";

type PlatformCard = {
  id: "mac" | "win" | "linux";
  label: string;
  detail: string;
  url: string | null;
};

export default async function DownloadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const links = getDesktopDownloadLinks();

  const platforms: PlatformCard[] = [
    {
      id: "mac",
      label: "macOS",
      detail: "Apple Silicon .dmg (Intel build also on Releases). Unsigned — Gatekeeper may warn.",
      url: links.macUrl,
    },
    {
      id: "win",
      label: "Windows",
      detail: "NSIS .exe installer. Unsigned — SmartScreen may warn.",
      url: links.winUrl,
    },
    {
      id: "linux",
      label: "Linux",
      detail: "AppImage (Debian .deb also on Releases).",
      url: links.linuxUrl,
    },
  ];

  return (
    <div className="gc-fade-up max-w-4xl">
      <p className="gc-eyebrow mb-2">Desktop</p>
      <h1 className="text-4xl mb-2">Download Grants &amp; Co OS</h1>
      <p className="gc-section-sub mb-8">
        Native desktop shell for the canonical web app at{" "}
        <span className="text-[var(--gc-gold)]">os.grantandconsultants.com</span>. No business logic or
        server secrets are bundled.
      </p>

      <div className="gc-panel p-6 mb-8">
        <p className="text-sm text-[var(--gc-muted)] leading-relaxed">
          Installers are published on GitHub Releases (unsigned v0.1.1). If the repository is
          private, stay signed into GitHub when downloading.
        </p>
        {links.releasesPageUrl ? (
          <p className="mt-4 text-sm">
            <a
              href={links.releasesPageUrl}
              className="text-[var(--gc-gold)] border-b border-[var(--gc-gold)]/35 hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              View all desktop releases
            </a>
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-10">
        {platforms.map((platform) => (
          <div key={platform.id} className="gc-card flex flex-col">
            <p className="gc-eyebrow mb-2">{platform.label}</p>
            <p className="text-sm text-[var(--gc-muted)] mb-5 flex-1">{platform.detail}</p>
            {platform.url ? (
              <a
                href={platform.url}
                className="gc-btn gc-btn-gold text-center text-sm py-2.5"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download for {platform.label}
              </a>
            ) : (
              <span className="inline-flex items-center justify-center rounded-full border border-[var(--gc-border)] px-4 py-2 text-xs tracking-[0.14em] uppercase text-[var(--gc-muted)]">
                Coming soon
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="gc-panel p-6">
        <p className="gc-eyebrow mb-2">Notes</p>
        <ul className="text-sm text-[var(--gc-muted)] space-y-2 list-disc pl-5">
          <li>First release is intentionally unsigned.</li>
          <li>Deep links use the <code className="text-[var(--gc-gold)]">grantscoos://</code> scheme.</li>
          <li>Production backend remains https://os.grantandconsultants.com — one shared database.</li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-4 text-sm">
          <Link href="/get" className="text-[var(--gc-gold)]">
            Public download page
          </Link>
          <Link href="/more" className="text-[var(--gc-gold)]">
            ← Back to More
          </Link>
        </div>
      </div>
    </div>
  );
}
