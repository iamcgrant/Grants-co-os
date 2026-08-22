import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { loginHref } from "@/lib/auth/return-to";
import { StaffShellClient } from "@/components/layout/StaffShellClient";
import { DESKTOP_SHELL_COOKIE, resolveDesktopShellMode } from "@/lib/nav/desktop-shell";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const headerStore = await headers();
  const pathname = headerStore.get("x-gc-pathname");
  if (!user) {
    redirect(loginHref(pathname));
  }
  if (user.role === "CLIENT") redirect("/portal");

  const cookieStore = await cookies();
  const desktopShellFromCookie = resolveDesktopShellMode({
    cookieValue: cookieStore.get(DESKTOP_SHELL_COOKIE)?.value,
    pathWithSearch: pathname,
  });

  return (
    <StaffShellClient user={user} desktopShellFromCookie={desktopShellFromCookie}>
      {children}
    </StaffShellClient>
  );
}
