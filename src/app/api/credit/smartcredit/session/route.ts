import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import {
  isSmartCreditSessionKind,
  recordSmartCreditSession,
  SMARTCREDIT_SESSION_KINDS,
  SmartCreditWorkspaceError,
} from "@/lib/credit/smartcredit-workspace";

const schema = z.object({
  clientId: z.string().min(1),
  kind: z.enum(SMARTCREDIT_SESSION_KINDS),
  notes: z.string().optional(),
  result: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_CREDIT");
    const body = schema.parse(await req.json());
    if (!isSmartCreditSessionKind(body.kind)) {
      return NextResponse.json({ error: "Unknown session kind" }, { status: 400 });
    }
    const result = await recordSmartCreditSession({
      clientId: body.clientId,
      kind: body.kind,
      notes: body.notes,
      result: body.result,
      actorId: user.id,
    });
    return NextResponse.json({
      kind: result.kind,
      lastStepUrl: result.lastStepUrl,
      recordedAt: result.recordedAt,
      sponsorConfigured: Boolean(result.sponsor.sponsorUrl || result.sponsor.sponsorCode),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      e instanceof SmartCreditWorkspaceError
        ? e.status
        : msg === "UNAUTHORIZED"
          ? 401
          : msg.startsWith("Forbidden") || msg === "FORBIDDEN"
            ? 403
            : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
