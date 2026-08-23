import { requireUser } from "@/lib/auth/session";
import { getLosService, readParams, toHttpResponse } from "../../../_handler";

/** POST /api/los/applications/:id/qualification */
export async function POST(_request: Request, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await readParams(ctx);
    return Response.json(getLosService().createQualificationSnapshot({ applicationId: id }));
  } catch (err) {
    return toHttpResponse(err);
  }
}
