import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { isPortalResultStatus, recordPortalResult } from "@/lib/portals/service";

const schema = z.object({
  resultStatus: z.string(),
  externalRef: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_CREDIT");
    const { id } = await ctx.params;
    const body = schema.parse(await req.json());
    if (!isPortalResultStatus(body.resultStatus)) {
      return NextResponse.json({ error: "Invalid result status" }, { status: 400 });
    }
    const session = await recordPortalResult({
      sessionId: id,
      actorId: user.id,
      resultStatus: body.resultStatus,
      externalRef: body.externalRef,
      notes: body.notes,
    });
    return NextResponse.json({ session });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
