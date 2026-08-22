/** First-party Grant & Co OS desktop presentation mode (Electron shell only). */

export const DESKTOP_SHELL_COOKIE = "gc_shell";
export const DESKTOP_SHELL_VALUE = "app";
export const DESKTOP_SHELL_OFF = "off";
export const DESKTOP_SHELL_QUERY = "gc_shell";

export function isDesktopShellValue(value: string | null | undefined): boolean {
  return value === DESKTOP_SHELL_VALUE;
}

export function isDesktopShellOff(value: string | null | undefined): boolean {
  return value === DESKTOP_SHELL_OFF;
}

export function desktopShellCookieOptions(secure: boolean): {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
  };
}

export function isDesktopShellCookieSecure(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.GC_FORCE_SECURE_COOKIES === "1" ||
    process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") === true
  );
}

function searchFromPath(pathWithSearch: string | null | undefined): URLSearchParams {
  if (!pathWithSearch) return new URLSearchParams();
  const qIndex = pathWithSearch.indexOf("?");
  if (qIndex === -1) return new URLSearchParams();
  return new URLSearchParams(pathWithSearch.slice(qIndex + 1));
}

export function gcShellQueryValue(pathWithSearch: string | null | undefined): string | null {
  return searchFromPath(pathWithSearch).get(DESKTOP_SHELL_QUERY);
}

export function hasDesktopShellFlag(pathWithSearch: string | null | undefined): boolean {
  return isDesktopShellValue(gcShellQueryValue(pathWithSearch));
}

export function stripDesktopShellQuery(pathWithSearch: string): string {
  const qIndex = pathWithSearch.indexOf("?");
  if (qIndex === -1) return pathWithSearch;
  const pathname = pathWithSearch.slice(0, qIndex) || "/";
  const params = new URLSearchParams(pathWithSearch.slice(qIndex + 1));
  params.delete(DESKTOP_SHELL_QUERY);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function withDesktopShellQuery(pathWithSearch: string): string {
  const qIndex = pathWithSearch.indexOf("?");
  const pathname = (qIndex === -1 ? pathWithSearch : pathWithSearch.slice(0, qIndex)) || "/";
  const params = new URLSearchParams(qIndex === -1 ? "" : pathWithSearch.slice(qIndex + 1));
  params.delete(DESKTOP_SHELL_QUERY);
  params.set(DESKTOP_SHELL_QUERY, DESKTOP_SHELL_VALUE);
  return `${pathname}?${params.toString()}`;
}

/** Query wins: `off` disables even if the cookie is set; `app` enables. Cookie is the fallback. */
export function resolveDesktopShellMode(input: {
  cookieValue?: string | null;
  queryValue?: string | null;
  pathWithSearch?: string | null;
}): boolean {
  const queryValue = input.queryValue ?? gcShellQueryValue(input.pathWithSearch ?? null);
  if (isDesktopShellOff(queryValue)) return false;
  if (isDesktopShellValue(queryValue)) return true;
  return isDesktopShellValue(input.cookieValue);
}
