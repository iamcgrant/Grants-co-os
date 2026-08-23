import { requireUser } from "@/lib/auth/session";
import { getLosService, toHttpResponse, readParams } from "../../_handler";

/** GET /api/los/applications/:id */
export async function GET(_request: Request, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await readParams(ctx);
    return Response.json(getLosService().getApplication(id));
  } catch (err) {
    return toHttpResponse(err);
  }
}
