import { getLosService, toHttpResponse, readParams } from "../../_handler";

/** GET /api/los/applications/:id */
export async function GET(_request: Request, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const { id } = await readParams(ctx);
    return Response.json(getLosService().getApplication(id));
  } catch (err) {
    return toHttpResponse(err);
  }
}
