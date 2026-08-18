export type DesktopDownloadLinks = {
  releasesPageUrl: string | null;
  macUrl: string | null;
  winUrl: string | null;
  linuxUrl: string | null;
  anyConfigured: boolean;
  fromEnv: boolean;
};

const DEFAULT_RELEASES = "https://github.com/iamcgrant/Grants-co-os/releases/tag/desktop-v0.1.2";

/** Published unsigned v0.1.2 assets (repo may be private — open while logged into GitHub). */
const DEFAULT_MAC =
  "https://github.com/iamcgrant/Grants-co-os/releases/download/desktop-v0.1.2/Grants.Co.OS_0.1.1_aarch64.dmg";
const DEFAULT_WIN =
  "https://github.com/iamcgrant/Grants-co-os/releases/download/desktop-v0.1.2/Grants.Co.OS_0.1.1_x64-setup.exe";
const DEFAULT_LINUX =
  "https://github.com/iamcgrant/Grants-co-os/releases/download/desktop-v0.1.2/Grants.Co.OS_0.1.1_amd64.AppImage";

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/**
 * Server-side desktop download configuration (public URLs only — no secrets).
 * Env overrides win; otherwise fall back to the published desktop-v0.1.1 release.
 */
export function getDesktopDownloadLinks(): DesktopDownloadLinks {
  const macUrl = readEnv("GC_DESKTOP_MAC_URL") || DEFAULT_MAC;
  const winUrl = readEnv("GC_DESKTOP_WIN_URL") || DEFAULT_WIN;
  const linuxUrl = readEnv("GC_DESKTOP_LINUX_URL") || DEFAULT_LINUX;
  const releasesPageUrl = readEnv("GC_DESKTOP_RELEASES_URL") || DEFAULT_RELEASES;
  const fromEnv = Boolean(
    readEnv("GC_DESKTOP_MAC_URL") || readEnv("GC_DESKTOP_WIN_URL") || readEnv("GC_DESKTOP_LINUX_URL"),
  );

  return {
    releasesPageUrl,
    macUrl,
    winUrl,
    linuxUrl,
    anyConfigured: Boolean(macUrl || winUrl || linuxUrl),
    fromEnv,
  };
}

/** Parse GitHub release asset list into platform download URLs (no secrets). */
export function pickDesktopAssetsFromRelease(assets: Array<{ name: string; browser_download_url: string }>): {
  macUrl: string | null;
  winUrl: string | null;
  linuxUrl: string | null;
} {
  const lower = (n: string) => n.toLowerCase();
  const find = (...preds: Array<(n: string) => boolean>) =>
    assets.find((a) => preds.every((p) => p(lower(a.name))))?.browser_download_url || null;

  const macUrl =
    find((n) => n.endsWith(".dmg") && n.includes("aarch64")) ||
    find((n) => n.endsWith(".dmg")) ||
    find((n) => n.endsWith(".app.tar.gz"));

  const winUrl = find((n) => n.endsWith(".exe")) || find((n) => n.endsWith(".msi"));

  const linuxUrl =
    find((n) => n.endsWith(".appimage")) || find((n) => n.endsWith(".deb"));

  return { macUrl, winUrl, linuxUrl };
}
