export type DesktopDownloadLinks = {
  releasesPageUrl: string | null;
  macUrl: string | null;
  winUrl: string | null;
  linuxUrl: string | null;
  anyConfigured: boolean;
};

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/** Server-side desktop download configuration (public URLs only). */
export function getDesktopDownloadLinks(): DesktopDownloadLinks {
  const macUrl = readEnv("GC_DESKTOP_MAC_URL");
  const winUrl = readEnv("GC_DESKTOP_WIN_URL");
  const linuxUrl = readEnv("GC_DESKTOP_LINUX_URL");
  const releasesPageUrl = readEnv("GC_DESKTOP_RELEASES_URL");

  return {
    releasesPageUrl,
    macUrl,
    winUrl,
    linuxUrl,
    anyConfigured: Boolean(macUrl || winUrl || linuxUrl),
  };
}
