"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { StaffShell } from "@/components/layout/StaffShell";
import type { AuthUserView } from "@/lib/auth/types";

function StaffShellWithLocation({
  user,
  children,
}: {
  user: AuthUserView;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/home";
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const location = qs ? `${pathname}?${qs}` : pathname;
  return (
    <StaffShell user={user} pathname={location}>
      {children}
    </StaffShell>
  );
}

export function StaffShellClient({
  user,
  children,
}: {
  user: AuthUserView;
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<StaffShell user={user}>{children}</StaffShell>}>
      <StaffShellWithLocation user={user}>{children}</StaffShellWithLocation>
    </Suspense>
  );
}
