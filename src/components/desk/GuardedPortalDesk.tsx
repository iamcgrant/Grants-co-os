import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireCreditStaff } from "@/lib/disputes/access";
import { requireTaxStaff } from "@/lib/tax/access";
import { PortalDesk } from "@/components/desk/PortalDesk";
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
      if (!user) redirect("/login");
      break;
    }
    default: {
      const _exhaustive: never = gate;
      return _exhaustive;
    }
  }
  return <PortalDesk deskId={deskId} />;
}
