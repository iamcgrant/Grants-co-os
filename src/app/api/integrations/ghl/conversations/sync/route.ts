import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { pullGhlConversationsForLinkedMasters } from "@/lib/integrations/ghl/conversations";
import { GhlApiError } from "@/lib/integrations/ghl/http";
import { getGcEnvironment } from "@/lib/integrations/env";

const bodySchema = z.object({
  dryRun: z.boolean().optional(),
});

/**
 * Inbound GHL conversations → Grants OS inbox for already-linked masters only.
 * Never sends SMS/email/iMessage. Never creates GHL contacts or Grants clients.
 * Without GHL_API_KEY the live path fails closed.
 * Missing conversations.readonly (or conversations/message.readonly) also fails closed.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_OPERATIONS");

    const json = await req.json().catch(() => ({}));
    const body = bodySchema.parse(json);

    const pull = await pullGhlConversationsForLinkedMasters({
      actorId: user.id,
      dryRun: body.dryRun,
    });

    return NextResponse.json({
      dataPlane: getGcEnvironment(),
      ...pull,
    });
  } catch (e) {
    if (e instanceof GhlApiError) {
      return NextResponse.json(
        {
          error: e.message,
          awaitingIntegration: e.status === 503,
          failedClosed: e.status === 401 || e.status === 403 || e.status === 503,
          requiredScope: e.requiredScope,
        },
        { status: e.status === 503 ? 503 : e.status === 401 || e.status === 403 ? 403 : 502 },
      );
    }
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
