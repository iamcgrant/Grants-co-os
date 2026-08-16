import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import {
  attachConfirmedDfRoster,
  pullDisputeFoxClients,
  syncDisputeFoxClientToGrants,
} from "@/lib/integrations/disputefox/sync";
import { DisputeFoxApiError } from "@/lib/integrations/disputefox/http";
import { getGcEnvironment } from "@/lib/integrations/env";

const bodySchema = z.object({
  mode: z.enum(["local", "pull", "contact"]).default("local"),
  email: z.string().email().optional(),
  stage: z.string().optional(),
  started: z.boolean().optional(),
  disputeFoxClientId: z.string().min(1).optional(),
  dryRun: z.boolean().optional(),
});

/**
 * Inbound DisputeFox → Grants Client attach onto existing master records only.
 * Never sends messages. Never creates/updates/deletes DisputeFox records.
 * Never creates Grants clients. Live path fails closed without DISPUTEFOX_API_KEY.
 * Default mode is local roster attach (no invented DF ids). Zap 374413762 stays OFF.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_OPERATIONS");

    const json = await req.json().catch(() => ({}));
    const body = bodySchema.parse(json);

    if (body.mode === "contact") {
      const result = await syncDisputeFoxClientToGrants(
        {
          id: body.disputeFoxClientId,
          email: body.email,
          stage: body.stage,
          started: body.started,
        },
        user.id,
        { dryRun: body.dryRun },
      );
      return NextResponse.json({
        dataPlane: getGcEnvironment(),
        zapEnabled: false,
        inventedDfId: false,
        result,
      });
    }

    if (body.mode === "pull") {
      const pull = await pullDisputeFoxClients({
        actorId: user.id,
        dryRun: body.dryRun,
      });
      return NextResponse.json({
        dataPlane: getGcEnvironment(),
        ...pull,
      });
    }

    const local = await attachConfirmedDfRoster({
      actorId: user.id,
      dryRun: body.dryRun,
    });
    return NextResponse.json({
      dataPlane: getGcEnvironment(),
      ...local,
    });
  } catch (e) {
    if (e instanceof DisputeFoxApiError) {
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
