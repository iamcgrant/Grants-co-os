import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { CognitoApiError, pullCognitoSubmissions } from "@/lib/integrations/cognito/workspace";

export async function POST() {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_OPERATIONS");
    const result = await pullCognitoSubmissions({ actorId: user.id });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      e instanceof CognitoApiError
        ? e.status
        : msg === "UNAUTHORIZED"
          ? 401
          : msg.startsWith("Forbidden") || msg === "FORBIDDEN"
            ? 403
            : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
