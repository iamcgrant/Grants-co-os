import { GuardedPortalDesk } from "@/components/desk/GuardedPortalDesk";

export default async function DisputeFoxWorkspacePage() {
  return GuardedPortalDesk({ deskId: "disputefox", gate: "credit" });
}
