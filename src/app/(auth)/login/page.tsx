import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/lib/auth/session";
import { pathAfterLogin, safeStaffReturnTo } from "@/lib/auth/return-to";
import { DESKTOP_SHELL_COOKIE, resolveDesktopShellMode } from "@/lib/nav/desktop-shell";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; gc_shell?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const desktopShell = resolveDesktopShellMode({
    cookieValue: cookieStore.get(DESKTOP_SHELL_COOKIE)?.value,
    queryValue: params.gc_shell,
  });
  const user = await getCurrentUser();
  if (user) {
    redirect(pathAfterLogin(user.role, params.returnTo, desktopShell));
  }
  return (
    <LoginForm returnTo={safeStaffReturnTo(params.returnTo)} desktopShell={desktopShell} />
  );
}
