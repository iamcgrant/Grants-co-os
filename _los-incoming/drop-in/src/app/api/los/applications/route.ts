import { getLosService, readJson, toHttpResponse } from "../_handler";

/** POST /api/los/applications */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const result = getLosService().createApplication({ clientId: body.clientId });
    return Response.json(result, { status: 201 });
  } catch (err) {
    return toHttpResponse(err);
  }
}
