import { requireUser } from "@/lib/auth/session";
import { assertApplicationAccess } from "@/lib/los/access";
import { callLos, readParams, toHttpResponse } from "../../../_handler";

/** POST /api/los/applications/:id/qualification */
export async function POST(_request: Request, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await readParams(ctx);
    await assertApplicationAccess(user, id);
    const result = await callLos((los) => los.createQualificationSnapshot({ applicationId: id }));
    return Response.json(result);
  } catch (err) {
    return toHttpResponse(err);
  }
}
