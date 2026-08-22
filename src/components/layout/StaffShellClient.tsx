"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { StaffShell } from "@/components/layout/StaffShell";
import { DESKTOP_SHELL_QUERY, resolveDesktopShellMode } from "@/lib/nav/desktop-shell";
import type { AuthUserView } from "@/lib/auth/types";

function StaffShellWithLocation({
  user,
  children,
  desktopShellFromCookie,
}: {
  user: AuthUserView;
  children: React.ReactNode;
  desktopShellFromCookie: boolean;
}) {
  const pathname = usePathname() || "/home";
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const location = qs ? `${pathname}?${qs}` : pathname;
  const desktopShell = resolveDesktopShellMode({
    cookieValue: desktopShellFromCookie ? "app" : null,
    queryValue: searchParams.get(DESKTOP_SHELL_QUERY),
  });
  return (
    <StaffShell user={user} pathname={location} desktopShell={desktopShell}>
      {children}
    </StaffShell>
  );
}

export function StaffShellClient({
  user,
  children,
  desktopShellFromCookie = false,
}: {
  user: AuthUserView;
  children: React.ReactNode;
  desktopShellFromCookie?: boolean;
}) {
  return (
    <Suspense
      fallback={
        <StaffShell user={user} desktopShell={desktopShellFromCookie}>
          {children}
        </StaffShell>
      }
    >
      <StaffShellWithLocation user={user} desktopShellFromCookie={desktopShellFromCookie}>
        {children}
      </StaffShellWithLocation>
    </Suspense>
  );
}
