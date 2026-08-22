import { GuardedPortalDesk } from "@/components/desk/GuardedPortalDesk";

export default async function DialerPage() {
  return GuardedPortalDesk({ deskId: "ghl-dialer", gate: "staff" });
}
