import { GuardedPortalDesk } from "@/components/desk/GuardedPortalDesk";

export default async function TeamChatPage() {
  return GuardedPortalDesk({ deskId: "telegram", gate: "staff" });
}
