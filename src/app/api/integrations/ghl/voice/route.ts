import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { probeGhlVoicePath, startGhlOutboundCall } from "@/lib/integrations/ghl/voice";

const callSchema = z.object({
  toE164: z.string().min(3).max(32),
  fromNumber: z.string().min(3).max(32).optional(),
  contactId: z.string().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user.role, "VIEW_INBOX");
    const probe = await probeGhlVoicePath();
    return NextResponse.json(probe);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "VIEW_INBOX");
    const parsed = callSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const result = await startGhlOutboundCall({
      ...parsed.data,
      staffUserId: user.id,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.reason,
          requiredScope: result.requiredScope,
          additionalScopesNeeded: result.additionalScopesNeeded,
          actionRequired: true,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
