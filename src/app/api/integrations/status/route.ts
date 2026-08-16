import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { integrationCredentialStatus } from "@/lib/integrations/credentials";

/**
 * Returns only boolean readiness flags — never secret values.
 */
export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_STAFF");
    return NextResponse.json({ status: integrationCredentialStatus() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
