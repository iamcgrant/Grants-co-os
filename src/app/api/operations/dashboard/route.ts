import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { getOperationsDashboard } from "@/lib/ops/dashboard";
import { Role } from "@/generated/prisma/client";

export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_OPERATIONS");
    const staffScoped =
      user.role === Role.FILE_PREPARER || user.role === Role.CUSTOMER_SERVICE
        ? user.id
        : undefined;
    const dashboard = await getOperationsDashboard(staffScoped);
    return NextResponse.json({ dashboard });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
