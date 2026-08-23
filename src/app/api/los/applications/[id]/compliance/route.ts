import { requireUser } from "@/lib/auth/session";
import { assertApplicationAccess } from "@/lib/los/access";
import { callLos, readJson, readParams, toHttpResponse } from "../../../_handler";

/** POST /api/los/applications/:id/compliance */
export async function POST(request: Request, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await readParams(ctx);
    await assertApplicationAccess(user, id);
    const body = await readJson(request);
    const result = await callLos((los) =>
      los.acknowledgeCompliance({
        applicationId: id,
        disclosures: body.disclosures ?? [],
        signature: body.signature,
        ip: body.ip ?? request.headers.get("x-forwarded-for") ?? undefined,
        userAgent: body.userAgent ?? request.headers.get("user-agent") ?? undefined,
        dpaSelected: body.dpaSelected,
        agreementVersion: body.agreementVersion,
      }),
    );
    return Response.json(result);
  } catch (err) {
    return toHttpResponse(err);
  }
}
