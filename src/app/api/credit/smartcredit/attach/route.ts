import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { attachSmartCreditClient, SmartCreditWorkspaceError } from "@/lib/credit/smartcredit-workspace";

const schema = z.object({
  clientId: z.string().min(1),
  externalId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_CREDIT");
    const body = schema.parse(await req.json());
    const result = await attachSmartCreditClient({
      clientId: body.clientId,
      externalId: body.externalId,
      actorId: user.id,
    });
    return NextResponse.json({
      identifier: result.identifier,
      client: result.client,
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
