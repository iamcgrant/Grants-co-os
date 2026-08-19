import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { inviteClientPortal } from "@/lib/clients/portal-invite";
import { getRequestOrigin } from "@/lib/access/origins";
import {
  getProductionDatabaseRefusal,
  productionDatabaseErrorBody,
} from "@/lib/db/production-guard";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  if (getProductionDatabaseRefusal()) {
    return NextResponse.json(productionDatabaseErrorBody(), { status: 503 });
  }

  try {
    const user = await requireUser();
    assertPermission(user.role, "CREATE_CLIENT");
    const { id } = await context.params;
    const invited = await inviteClientPortal({
      actorId: user.id,
      clientId: id,
      baseUrl: getRequestOrigin(req),
    });
    return NextResponse.json(invited);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
