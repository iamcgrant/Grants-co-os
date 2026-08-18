/** Permanent staff hostname — requires Squarespace CNAME host `os`. */
export const PERMANENT_OS_ORIGIN = "https://os.grantandconsultants.com";

/**
 * Live Vercel deployment Charles can open today.
 * `os.grantandconsultants.com` has no public DNS until BUILDX adds the CNAME.
 */
export const LIVE_VERCEL_APP_ORIGIN = "https://temporary-prompt-oboe-st5fuuv.vercel.app";

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

export function getPublicAppOrigin(): string {
  const fromEnv = stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL || "");
  return fromEnv || PERMANENT_OS_ORIGIN;
}

export function getDesktopPrimaryOrigin(): string {
  const fromEnv = stripTrailingSlash(process.env.GC_DESKTOP_URL || "");
  return fromEnv || PERMANENT_OS_ORIGIN;
}

export function getDesktopFallbackOrigin(): string {
  const fromEnv = stripTrailingSlash(process.env.GC_DESKTOP_FALLBACK_URL || "");
  return fromEnv || LIVE_VERCEL_APP_ORIGIN;
}
