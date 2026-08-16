"use client";

import { usePathname } from "next/navigation";
import { StaffShell } from "@/components/layout/StaffShell";
import type { AuthUserView } from "@/lib/auth/types";

export function StaffShellClient({
  user,
  children,
}: {
  user: AuthUserView;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/home";
  return (
    <StaffShell user={user} pathname={pathname}>
      {children}
    </StaffShell>
  );
}
