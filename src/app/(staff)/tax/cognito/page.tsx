import { GuardedPortalDesk } from "@/components/desk/GuardedPortalDesk";

export default async function CognitoWorkspacePage() {
  return GuardedPortalDesk({ deskId: "cognito", gate: "tax" });
}
