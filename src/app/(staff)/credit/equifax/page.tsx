import { GuardedPortalDesk } from "@/components/desk/GuardedPortalDesk";

export default async function EquifaxCasesPage() {
  return GuardedPortalDesk({ deskId: "equifax", gate: "credit" });
}
