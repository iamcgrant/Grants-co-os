import { GuardedPortalDesk } from "@/components/desk/GuardedPortalDesk";

export default async function CfpbCasesPage() {
  return GuardedPortalDesk({ deskId: "cfpb", gate: "credit" });
}
