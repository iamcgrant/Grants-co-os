import { GuardedPortalDesk } from "@/components/desk/GuardedPortalDesk";

export default async function TransUnionCasesPage() {
  return GuardedPortalDesk({ deskId: "transunion", gate: "credit" });
}
