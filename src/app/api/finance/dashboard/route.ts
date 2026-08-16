import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { getFinanceDashboard } from "@/lib/payments/dashboard";

export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user.role, "VIEW_FINANCE_DASHBOARD");
    const dashboard = await getFinanceDashboard();
    return NextResponse.json({ dashboard });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
