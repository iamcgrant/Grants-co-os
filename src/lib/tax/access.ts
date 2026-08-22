import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";

export async function requireTaxStaff() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_CLIENT") && !hasPermission(user.role, "MANAGE_OPERATIONS")) {
    return { user: null, denied: true };
  }
  return { user, denied: false as const };
}
