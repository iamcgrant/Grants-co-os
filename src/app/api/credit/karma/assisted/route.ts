import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { recordAssistedCreditKarmaScores } from "@/lib/credit/assisted-karma";

const schema = z.object({
  clientId: z.string().min(1),
  notes: z.string().max(2000).optional(),
  scores: z
    .array(
      z.object({
        bureau: z.enum(["EQUIFAX", "TRANSUNION", "EXPERIAN"]),
        score: z.number().int(),
        scoringModel: z.string().max(80).optional(),
      }),
    )
    .min(1)
    .max(3),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_CREDIT");
    const body = schema.parse(await req.json());
    const result = await recordAssistedCreditKarmaScores({
      clientId: body.clientId,
      actorId: user.id,
      scores: body.scores,
      notes: body.notes,
    });
    return NextResponse.json({
      ok: true,
      scrape: false,
      assisted: true,
      ...result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
