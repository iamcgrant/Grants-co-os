import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  DESKTOP_SHELL_COOKIE,
  DESKTOP_SHELL_QUERY,
  DESKTOP_SHELL_VALUE,
  desktopShellCookieOptions,
  isDesktopShellCookieSecure,
  isDesktopShellOff,
  isDesktopShellValue,
} from "@/lib/nav/desktop-shell";

/** Stamp the requested path so unauthenticated staff login can return there. */
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-gc-pathname", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const shellQuery = request.nextUrl.searchParams.get(DESKTOP_SHELL_QUERY);
  if (isDesktopShellValue(shellQuery)) {
    response.cookies.set(
      DESKTOP_SHELL_COOKIE,
      DESKTOP_SHELL_VALUE,
      desktopShellCookieOptions(isDesktopShellCookieSecure()),
    );
  } else if (isDesktopShellOff(shellQuery)) {
    response.cookies.delete(DESKTOP_SHELL_COOKIE);
  }

  return response;
}
