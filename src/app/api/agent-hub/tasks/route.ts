import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import {
  getTask,
  createCodeChangeAndLaunch,
  reportCursorResult,
  getAgentCapabilities,
} from "@/lib/agent-hub";

async function authorize(req: Request) {
  const hubToken = process.env.AGENT_HUB_TOKEN?.trim();
  const auth = req.headers.get("authorization") || "";
  if (hubToken && auth === `Bearer ${hubToken}`) return { mode: "hub" as const };
  const user = await requireUser();
  assertPermission(user.role, "MANAGE_OPERATIONS");
  return { mode: "session" as const, user };
}

export async function GET(req: Request) {
  try {
    await authorize(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (id) {
      const task = await getTask(id);
      if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ task });
    }
    const capabilities = await getAgentCapabilities();
    return NextResponse.json(capabilities);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("code_change"),
    title: z.string().min(3),
    prompt: z.string().min(3),
    ownerAgentId: z.string().optional(),
    idempotencyKey: z.string().optional(),
  }),
  z.object({
    action: z.literal("cursor_result"),
    taskId: z.string().min(1),
    status: z.enum(["COMPLETED", "FAILED"]),
    summary: z.string().min(1),
    prUrl: z.string().optional(),
    branch: z.string().optional(),
  }),
]);

export async function POST(req: Request) {
  try {
    await authorize(req);
    const body = postSchema.parse(await req.json());
    if (body.action === "code_change") {
      const result = await createCodeChangeAndLaunch(body);
      return NextResponse.json(result);
    }
    const result = await reportCursorResult(body);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
