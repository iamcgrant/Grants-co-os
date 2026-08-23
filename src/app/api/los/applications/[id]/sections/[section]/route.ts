import { requireUser } from "@/lib/auth/session";
import { getLosService, readJson, readParams, toHttpResponse } from "../../../../_handler";

/** PATCH /api/los/applications/:id/sections/:section */
export async function PATCH(
  request: Request,
  ctx: { params: { id: string; section: string } | Promise<{ id: string; section: string }> },
) {
  try {
    await requireUser();
    const { id, section } = await readParams(ctx);
    const body = await readJson(request);
    const result = getLosService().patchSection({
      applicationId: id,
      section,
      body: body.body ?? body,
    });
    return Response.json(result);
  } catch (err) {
    return toHttpResponse(err);
  }
}
