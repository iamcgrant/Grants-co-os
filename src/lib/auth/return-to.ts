/**
 * Preserve the in-OS path the staff clicked so login returns there.
 * Only same-origin app paths. Never an external portal.
 */

import {
  hasDesktopShellFlag,
  stripDesktopShellQuery,
  withDesktopShellQuery,
} from "@/lib/nav/desktop-shell";

const BLOCKED_PREFIXES = ["/login", "/portal", "/api", "/setup", "/pay/"];

export function safeStaffReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  let decoded = value.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // keep raw
  }
  if (!decoded.startsWith("/")) return null;
  if (decoded.startsWith("//")) return null;
  if (decoded.includes("://")) return null;
  if (decoded.includes("\\")) return null;
  for (const prefix of BLOCKED_PREFIXES) {
    if (decoded === prefix || decoded.startsWith(prefix)) return null;
  }
  return decoded;
}

export function loginHref(returnTo?: string | null): string {
  const safe = safeStaffReturnTo(returnTo);
  const shell = hasDesktopShellFlag(returnTo) || hasDesktopShellFlag(safe);
  const dest = safe ? stripDesktopShellQuery(safe) : null;
  const params = new URLSearchParams();
  if (shell) params.set("gc_shell", "app");
  if (dest) params.set("returnTo", dest);
  const qs = params.toString();
  return qs ? `/login?${qs}` : "/login";
}

export function pathAfterLogin(
  role: string,
  returnTo?: string | null,
  desktopShell?: boolean,
): string {
  if (role === "CLIENT") return "/portal";
  const path = safeStaffReturnTo(returnTo) ?? "/home";
  if (desktopShell || hasDesktopShellFlag(returnTo) || hasDesktopShellFlag(path)) {
    return withDesktopShellQuery(path);
  }
  return path;
}
