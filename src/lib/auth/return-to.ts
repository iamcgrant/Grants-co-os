/**
 * Preserve the in-OS path the staff clicked so login returns there.
 * Only same-origin app paths. Never an external portal.
 */

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
  return safe ? `/login?returnTo=${encodeURIComponent(safe)}` : "/login";
}

export function pathAfterLogin(role: string, returnTo?: string | null): string {
  if (role === "CLIENT") return "/portal";
  return safeStaffReturnTo(returnTo) ?? "/home";
}
