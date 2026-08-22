import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { listGhlLocationInbox } from "@/lib/integrations/ghl/conversations";

export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user.role, "VIEW_INBOX");
    const inbox = await listGhlLocationInbox();
    return NextResponse.json(inbox);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
