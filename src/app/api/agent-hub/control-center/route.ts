import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { getControlCenterSnapshot } from "@/lib/agent-hub";

async function authorize(req: Request) {
  const hubToken = process.env.AGENT_HUB_TOKEN?.trim();
  const auth = req.headers.get("authorization") || "";
  if (hubToken && auth === `Bearer ${hubToken}`) return;
  const user = await requireUser();
  assertPermission(user.role, "VIEW_CLIENT");
}

export async function GET(req: Request) {
  try {
    await authorize(req);
    const snapshot = await getControlCenterSnapshot();
    return NextResponse.json(snapshot);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
