import { requireUser } from "@/lib/auth/session";
import { clientIdForUser } from "@/lib/los/access";
import { callLos, readJson, toHttpResponse } from "../_handler";

/** POST /api/los/applications */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    let clientId = body.clientId as string | undefined;
    if (user.role === "CLIENT") {
      const resolved = await clientIdForUser(user.id);
      if (!resolved) {
        return Response.json({ error: "Client profile not linked" }, { status: 403 });
      }
      clientId = resolved;
    }
    if (!clientId) {
      return Response.json({ error: "clientId is required" }, { status: 422 });
    }
    const result = await callLos((los) => los.createApplication({ clientId }));
    return Response.json(result, { status: 201 });
  } catch (err) {
    return toHttpResponse(err);
  }
}
