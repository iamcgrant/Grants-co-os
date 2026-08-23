import { requireUser } from "@/lib/auth/session";
import { getLosService, readJson, readParams, toHttpResponse } from "../../../_handler";

/** POST /api/los/applications/:id/compliance */
export async function POST(request: Request, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await readParams(ctx);
    const body = await readJson(request);
    const result = getLosService().acknowledgeCompliance({
      applicationId: id,
      disclosures: body.disclosures ?? [],
      signature: body.signature,
      ip: body.ip,
      userAgent: body.userAgent,
      dpaSelected: body.dpaSelected,
      agreementVersion: body.agreementVersion,
    });
    return Response.json(result);
  } catch (err) {
    return toHttpResponse(err);
  }
}
