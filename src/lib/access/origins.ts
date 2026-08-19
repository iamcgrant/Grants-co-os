/** Permanent staff hostname — only used after Squarespace CNAME is confirmed. */
export const PERMANENT_OS_ORIGIN = "https://os.grantandconsultants.com";

/**
 * Guaranteed-online Vercel deployment. Use this for every public link until
 * `GC_PERMANENT_HOST_READY=1` (DNS + TLS for os.grantandconsultants.com).
 */
export const LIVE_VERCEL_APP_ORIGIN = "https://temporary-prompt-oboe-st5fuuv.vercel.app";

export const PERMANENT_HOST_READY_ENV = "GC_PERMANENT_HOST_READY";

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

export function isPermanentHostReady(): boolean {
  return process.env[PERMANENT_HOST_READY_ENV] === "1";
}

export function isPermanentOsOrigin(url: string): boolean {
  return stripTrailingSlash(url).toLowerCase() === PERMANENT_OS_ORIGIN;
}

/**
 * Origin that is safe to put in emails, invites, desktop, and login copy.
 * Never returns the NXDOMAIN host unless BUILDX flipped GC_PERMANENT_HOST_READY=1.
 */
export function getCanonicalOnlineOrigin(): string {
  if (isPermanentHostReady()) {
    const fromEnv = stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL || "");
    return fromEnv || PERMANENT_OS_ORIGIN;
  }
  const fromEnv = stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL || "");
  if (fromEnv && !isPermanentOsOrigin(fromEnv)) return fromEnv;
  return LIVE_VERCEL_APP_ORIGIN;
}

export function getPublicAppOrigin(): string {
  return getCanonicalOnlineOrigin();
}

export function getDesktopPrimaryOrigin(): string {
  const fromEnv = stripTrailingSlash(process.env.GC_DESKTOP_URL || "");
  if (fromEnv) return fromEnv;
  return getCanonicalOnlineOrigin();
}

export function getDesktopFallbackOrigin(): string {
  const fromEnv = stripTrailingSlash(process.env.GC_DESKTOP_FALLBACK_URL || "");
  if (fromEnv) return fromEnv;
  const primary = getDesktopPrimaryOrigin();
  return isPermanentOsOrigin(primary) ? LIVE_VERCEL_APP_ORIGIN : PERMANENT_OS_ORIGIN;
}

/** Prefer the host the browser actually reached so invites never point at NXDOMAIN. */
export function getRequestOrigin(req?: Request): string {
  if (req) {
    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").trim();
    const forwardedProto = req.headers.get("x-forwarded-proto") || "";
    if (host) {
      const isLocal = host.startsWith("localhost") || host.startsWith("127.");
      const proto = forwardedProto || (isLocal ? "http" : "https");
      const origin = stripTrailingSlash(`${proto}://${host}`);
      if (isPermanentOsOrigin(origin) && !isPermanentHostReady()) {
        return getCanonicalOnlineOrigin();
      }
      return origin;
    }
  }
  return getCanonicalOnlineOrigin();
}
