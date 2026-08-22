import { GuardedPortalDesk } from "@/components/desk/GuardedPortalDesk";

export default async function ExperianCasesPage() {
  return GuardedPortalDesk({ deskId: "experian", gate: "credit" });
}
