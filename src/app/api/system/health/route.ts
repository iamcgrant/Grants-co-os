import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { collectSystemHealth } from "@/lib/system/health";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "VIEW_OWNER_COMMAND")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const health = await collectSystemHealth();
  return NextResponse.json(health);
}
