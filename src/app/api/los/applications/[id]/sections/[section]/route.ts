import { requireUser } from "@/lib/auth/session";
import { assertApplicationAccess } from "@/lib/los/access";
import { callLos, readJson, readParams, toHttpResponse } from "../../../../_handler";

/** PATCH /api/los/applications/:id/sections/:section */
export async function PATCH(
  request: Request,
  ctx: { params: { id: string; section: string } | Promise<{ id: string; section: string }> },
) {
  try {
    const user = await requireUser();
    const { id, section } = await readParams(ctx);
    await assertApplicationAccess(user, id);
    const body = await readJson(request);
    const result = await callLos((los) =>
      los.patchSection({
        applicationId: id,
        section,
        body: body.body ?? body,
      }),
    );
    return Response.json(result);
  } catch (err) {
    return toHttpResponse(err);
  }
}

/** GET /api/los/applications/:id/sections/:section */
export async function GET(
  _request: Request,
  ctx: { params: { id: string; section: string } | Promise<{ id: string; section: string }> },
) {
  try {
    const user = await requireUser();
    const { id, section } = await readParams(ctx);
    await assertApplicationAccess(user, id);
    const result = await callLos((los) => los.getSection(id, section));
    return Response.json(result ?? { section, body: null });
  } catch (err) {
    return toHttpResponse(err);
  }
}
