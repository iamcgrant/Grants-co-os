import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { InviteStaffForm } from "@/components/staff/InviteStaffForm";
import { getCanonicalOnlineOrigin } from "@/lib/access/origins";

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "MANAGE_STAFF")) {
    return <p className="p-8">Access denied.</p>;
  }

  const loginUrl = `${getCanonicalOnlineOrigin()}/login`;

  return (
    <div className="gc-fade-up max-w-3xl">
      <p className="gc-eyebrow mb-2">People</p>
      <h1 className="text-4xl mb-2">Team logins</h1>
      <p className="gc-section-sub mb-8">
        Invite employees. They open the setup link, choose a password, then sign in at{" "}
        <a href={loginUrl} className="text-[var(--gc-gold)]">
          {loginUrl}
        </a>
        . Client portal invites live on each client 360.
      </p>
      <InviteStaffForm />
    </div>
  );
}
