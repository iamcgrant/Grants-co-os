import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { DESKTOP_SHELL_COOKIE, resolveDesktopShellMode, withDesktopShellQuery } from "@/lib/nav/desktop-shell";

export default async function RootPage() {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const desktopShell = resolveDesktopShellMode({
    cookieValue: cookieStore.get(DESKTOP_SHELL_COOKIE)?.value,
  });
  if (!user) redirect(desktopShell ? "/login?gc_shell=app" : "/login");
  if (user.role === "CLIENT") redirect("/portal");
  redirect(desktopShell ? withDesktopShellQuery("/home") : "/home");
}
