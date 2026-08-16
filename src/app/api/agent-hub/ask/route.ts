import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { routeAndAsk } from "@/lib/agent-hub";

const schema = z.object({
  question: z.string().min(3).max(4000),
  agentId: z
    .enum(["x1-operations", "payment-processing", "cursor-engineering", "auto"])
    .optional(),
  actionCode: z.string().optional(),
});

async function authorize(req: Request) {
  const hubToken = process.env.AGENT_HUB_TOKEN?.trim();
  const auth = req.headers.get("authorization") || "";
  if (hubToken && auth === `Bearer ${hubToken}`) {
    return { mode: "hub_token" as const };
  }
  // Dev/local mesh: allow AGENT_HUB_ALLOW_UNAUTH=true for MCP stdio on trusted host
  if (process.env.AGENT_HUB_ALLOW_UNAUTH === "true" && process.env.GC_ENV !== "production") {
    return { mode: "dev_unauth" as const };
  }
  const user = await requireUser();
  assertPermission(user.role, "MANAGE_OPERATIONS");
  return { mode: "session" as const, user };
}

export async function POST(req: Request) {
  try {
    await authorize(req);
    const body = schema.parse(await req.json());
    const routed = await routeAndAsk({
      question: body.question,
      preferredAgentId:
        !body.agentId || body.agentId === "auto" ? undefined : body.agentId,
      actionCode: body.actionCode,
      fromRole: "CURSOR",
    });
    return NextResponse.json(routed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
