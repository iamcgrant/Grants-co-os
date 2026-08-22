import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { loadGhlClientDesk } from "@/lib/integrations/ghl/workspace";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "VIEW_INBOX");
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId")?.trim();
    const conversationId = url.searchParams.get("conversationId")?.trim() || undefined;
    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }
    const desk = await loadGhlClientDesk({ clientId, conversationId });
    return NextResponse.json(desk);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
