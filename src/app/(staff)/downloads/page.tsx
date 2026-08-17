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
      detail: "Apple Silicon and Intel builds from GitHub Releases",
      url: links.macUrl,
    },
    {
      id: "win",
      label: "Windows",
      detail: "NSIS installer (.exe) or MSI when published",
      url: links.winUrl,
    },
    {
      id: "linux",
      label: "Linux",
      detail: "AppImage or Debian package",
      url: links.linuxUrl,
    },
  ];

  return (
    <div className="gc-fade-up max-w-4xl">
      <p className="gc-eyebrow mb-2">Desktop</p>
      <h1 className="text-4xl mb-2">Download Grants &amp; Co OS</h1>
      <p className="gc-section-sub mb-8">
        Native desktop shell for the canonical web app at{" "}
        <span className="text-[var(--gc-gold)]">os.grantsandco.com</span>. No business logic is
        bundled — only a secure window around production.
      </p>

      <div className="gc-panel p-6 mb-8">
        <p className="text-sm text-[var(--gc-muted)] leading-relaxed">
          {links.anyConfigured
            ? "Install the build for your platform below. Updates ship through GitHub Releases when signing and updater keys are configured."
            : "Release pending — desktop installers are built in CI but download URLs are not configured yet."}
        </p>
        {links.releasesPageUrl ? (
          <p className="mt-4 text-sm">
            <a
              href={links.releasesPageUrl}
              className="text-[var(--gc-gold)] border-b border-[var(--gc-gold)]/35 hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              View all releases
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
          <li>macOS and Windows builds require optional signing secrets in GitHub Actions.</li>
          <li>Linux AppImage and .deb packages build without code signing today.</li>
          <li>Deep links use the <code className="text-[var(--gc-gold)]">grantscoos://</code> scheme.</li>
        </ul>
        <Link href="/more" className="inline-block mt-5 text-sm text-[var(--gc-gold)]">
          ← Back to More
        </Link>
      </div>
    </div>
  );
}
