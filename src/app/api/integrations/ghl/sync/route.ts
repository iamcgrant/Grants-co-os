import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { pullGhlContacts, syncGhlContactById } from "@/lib/integrations/ghl/sync";
import { GhlApiError } from "@/lib/integrations/ghl/http";
import { getGcEnvironment } from "@/lib/integrations/env";

const bodySchema = z.object({
  mode: z.enum(["pull", "contact"]).default("pull"),
  ghlContactId: z.string().min(1).optional(),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

/**
 * Inbound GHL → Grants Client sync.
 * Never sends messages. Never creates contacts in GHL.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_OPERATIONS");

    const json = await req.json().catch(() => ({}));
    const body = bodySchema.parse(json);

    if (body.mode === "contact") {
      if (!body.ghlContactId) {
        return NextResponse.json({ error: "ghlContactId required" }, { status: 400 });
      }
      const result = await syncGhlContactById(body.ghlContactId, user.id);
      return NextResponse.json({
        dataPlane: getGcEnvironment(),
        result,
      });
    }

    const pull = await pullGhlContacts({
      query: body.query,
      limit: body.limit,
      actorId: user.id,
    });

    return NextResponse.json({
      dataPlane: getGcEnvironment(),
      ...pull,
    });
  } catch (e) {
    if (e instanceof GhlApiError) {
      return NextResponse.json(
        { error: e.message, awaitingIntegration: e.status === 503 },
        { status: e.status === 503 ? 503 : 502 },
      );
    }
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
