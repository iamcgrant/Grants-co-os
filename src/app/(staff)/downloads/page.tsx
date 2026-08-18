import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getDesktopDownloadLinks,
  pickDesktopAssetsFromRelease,
} from "@/lib/desktop/downloads";

type PlatformCard = {
  id: "mac" | "win" | "linux";
  label: string;
  detail: string;
  url: string | null;
  unsignedHint?: boolean;
};

async function resolveLinks() {
  const base = getDesktopDownloadLinks();
  if (base.anyConfigured) return base;

  // Optional auto-resolve from latest GitHub release when GH token available server-side.
  // Never required for runtime — fails closed to "Coming soon" / releases page.
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  try {
    const res = await fetch(
      "https://api.github.com/repos/iamcgrant/Grants-co-os/releases?per_page=5",
      {
        headers: {
          Accept: "application/vnd.github+json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "User-Agent": "Grants-Co-OS-Downloads",
        },
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return base;
    const releases = (await res.json()) as Array<{
      draft?: boolean;
      prerelease?: boolean;
      html_url?: string;
      assets?: Array<{ name: string; browser_download_url: string }>;
    }>;
    const release =
      releases.find((r) => !r.draft && (r.assets?.length || 0) > 0) ||
      releases.find((r) => (r.assets?.length || 0) > 0);
    if (!release?.assets?.length) return base;
    const picked = pickDesktopAssetsFromRelease(release.assets);
    const any = Boolean(picked.macUrl || picked.winUrl || picked.linuxUrl);
    return {
      ...base,
      ...picked,
      releasesPageUrl: release.html_url || base.releasesPageUrl,
      anyConfigured: any,
      fromEnv: false,
    };
  } catch {
    return base;
  }
}

export default async function DownloadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const links = await resolveLinks();

  const platforms: PlatformCard[] = [
    {
      id: "mac",
      label: "macOS",
      detail: "Download .dmg / .app (unsigned until Apple signing is configured)",
      url: links.macUrl,
      unsignedHint: true,
    },
    {
      id: "win",
      label: "Windows",
      detail: "Download .exe / .msi (unsigned until Authenticode is configured)",
      url: links.winUrl,
      unsignedHint: true,
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
        <span className="text-[var(--gc-gold)]">os.grantsandco.com</span>. No business logic or
        server secrets are bundled — only a secure window around production.
      </p>

      <div className="gc-panel p-6 mb-8">
        <p className="text-sm text-[var(--gc-muted)] leading-relaxed">
          {links.anyConfigured
            ? "Install the build for your platform below. First releases may be unsigned — macOS Gatekeeper / Windows SmartScreen may warn until signing certificates are added."
            : "Release pending — installers are building in CI. Open the releases page or check back once Mac / Windows / Linux assets are published."}
        </p>
        {links.releasesPageUrl ? (
          <p className="mt-4 text-sm">
            <a
              href={links.releasesPageUrl}
              className="text-[var(--gc-gold)] border-b border-[var(--gc-gold)]/35 hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              View GitHub Releases
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
          <li>Unsigned Mac/Windows builds are intentional for the first downloadable release.</li>
          <li>Linux AppImage and .deb packages do not require code signing.</li>
          <li>
            Deep links use the <code className="text-[var(--gc-gold)]">grantscoos://</code> scheme.
          </li>
          <li>Production backend remains https://os.grantsandco.com — one shared database.</li>
        </ul>
        <Link href="/more" className="inline-block mt-5 text-sm text-[var(--gc-gold)]">
          ← Back to More
        </Link>
      </div>
    </div>
  );
}
