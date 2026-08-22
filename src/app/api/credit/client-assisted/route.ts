import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { parseAssistedBureau, recordClientAssistedScore } from "@/lib/credit/client-assisted";

const schema = z.object({
  clientId: z.string().min(1),
  bureau: z.string().min(1),
  score: z.number().int(),
  scoringModel: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_CREDIT");
    const body = schema.parse(await req.json());
    const row = await recordClientAssistedScore({
      clientId: body.clientId,
      bureau: parseAssistedBureau(body.bureau),
      score: body.score,
      scoringModel: body.scoringModel,
    });
    return NextResponse.json({ score: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
