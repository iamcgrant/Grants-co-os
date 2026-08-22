import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { loginHref } from "@/lib/auth/return-to";
import { requireCreditStaff } from "@/lib/disputes/access";
import { requireTaxStaff } from "@/lib/tax/access";
import { PortalDesk } from "@/components/desk/PortalDesk";
import { DESKTOP_SHELL_COOKIE, resolveDesktopShellMode } from "@/lib/nav/desktop-shell";
import type { PortalDeskId } from "@/lib/nav/portal-desks";

export async function GuardedPortalDesk({
  deskId,
  gate,
}: {
  deskId: PortalDeskId;
  gate: "credit" | "tax" | "staff";
}) {
  switch (gate) {
    case "credit": {
      const { user, denied } = await requireCreditStaff();
      if (denied || !user) return <p>Access denied.</p>;
      break;
    }
    case "tax": {
      const { user, denied } = await requireTaxStaff();
      if (denied || !user) return <p>Access denied.</p>;
      break;
    }
    case "staff": {
      const user = await getCurrentUser();
      if (!user) {
        const headerStore = await headers();
        redirect(loginHref(headerStore.get("x-gc-pathname")));
      }
      break;
    }
    default: {
      const _exhaustive: never = gate;
      return _exhaustive;
    }
  }
  let desktopShell = false;
  try {
    const cookieStore = await cookies();
    const headerStore = await headers();
    desktopShell = resolveDesktopShellMode({
      cookieValue: cookieStore.get(DESKTOP_SHELL_COOKIE)?.value,
      pathWithSearch: headerStore.get("x-gc-pathname"),
    });
  } catch {
    desktopShell = false;
  }
  return <PortalDesk deskId={deskId} desktopShell={desktopShell} />;
}
