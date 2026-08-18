export type DesktopDownloadLinks = {
  releasesPageUrl: string | null;
  macUrl: string | null;
  winUrl: string | null;
  linuxUrl: string | null;
  anyConfigured: boolean;
  /** True when URLs came from explicit env vars (preferred for production). */
  fromEnv: boolean;
};

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/**
 * Server-side desktop download configuration (public URLs only).
 * Prefer explicit GC_DESKTOP_*_URL env vars. Optional fallback:
 * GC_DESKTOP_RELEASES_URL pointing at a GitHub Releases page.
 */
export function getDesktopDownloadLinks(): DesktopDownloadLinks {
  const macUrl = readEnv("GC_DESKTOP_MAC_URL");
  const winUrl = readEnv("GC_DESKTOP_WIN_URL");
  const linuxUrl = readEnv("GC_DESKTOP_LINUX_URL");
  const releasesPageUrl =
    readEnv("GC_DESKTOP_RELEASES_URL") ||
    "https://github.com/iamcgrant/Grants-co-os/releases";

  const fromEnv = Boolean(macUrl || winUrl || linuxUrl);

  return {
    releasesPageUrl,
    macUrl,
    winUrl,
    linuxUrl,
    anyConfigured: fromEnv,
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
    find((n) => n.endsWith(".dmg")) ||
    find((n) => n.endsWith(".app.tar.gz")) ||
    find((n) => n.includes("darwin") && (n.endsWith(".zip") || n.endsWith(".tar.gz")));

  const winUrl =
    find((n) => n.endsWith(".exe")) ||
    find((n) => n.endsWith(".msi"));

  const linuxUrl =
    find((n) => n.endsWith(".appimage")) ||
    find((n) => n.endsWith(".deb"));

  return { macUrl, winUrl, linuxUrl };
}
