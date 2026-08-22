import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Stamp the requested path so unauthenticated staff login can return there. */
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-gc-pathname", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
