import { requireUser } from "@/lib/auth/session";
import { assertApplicationAccess } from "@/lib/los/access";
import { callLos, toHttpResponse, readParams } from "../../_handler";

/** GET /api/los/applications/:id */
export async function GET(_request: Request, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await readParams(ctx);
    await assertApplicationAccess(user, id);
    const result = await callLos((los) => los.getApplication(id));
    return Response.json(result);
  } catch (err) {
    return toHttpResponse(err);
  }
}
