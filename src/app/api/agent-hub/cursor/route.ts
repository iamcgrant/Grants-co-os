import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import {
  drainAwaitingCursorLaunches,
  syncWaitingCursorTasks,
  ingestCursorAgentReturn,
  probeCursorApiKey,
  getCursorAgentStatus,
  isCursorLaunchReady,
  startCursorReturnPoller,
} from "@/lib/agent-hub";

startCursorReturnPoller();

async function authorize(req: Request) {
  const hubToken = process.env.AGENT_HUB_TOKEN?.trim();
  const auth = req.headers.get("authorization") || "";
  if (hubToken && auth === `Bearer ${hubToken}`) return;
  if (process.env.AGENT_HUB_ALLOW_UNAUTH === "true" && process.env.GC_ENV !== "production") return;
  const user = await requireUser();
  assertPermission(user.role, "MANAGE_STAFF");
}

export async function GET(req: Request) {
  try {
    await authorize(req);
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    if (action === "sync") {
      return NextResponse.json(await syncWaitingCursorTasks());
    }
    const agentId = url.searchParams.get("agentId");
    if (agentId) {
      return NextResponse.json(await getCursorAgentStatus(agentId));
    }
    const probe = await probeCursorApiKey();
    return NextResponse.json({
      launchReady: isCursorLaunchReady(),
      probe,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

const postSchema = z.object({
  action: z.enum(["drain", "sync", "ingest"]).default("drain"),
  limit: z.number().int().min(1).max(50).optional(),
  cursorAgentId: z.string().min(3).optional(),
  taskId: z.string().min(1).optional(),
  cursorRunId: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).optional(),
  forceWaiting: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    await authorize(req);
    const body = postSchema.parse(await req.json().catch(() => ({ action: "drain" })));
    if (body.action === "sync") {
      return NextResponse.json(await syncWaitingCursorTasks(body.limit));
    }
    if (body.action === "ingest") {
      if (!body.cursorAgentId) {
        return NextResponse.json({ error: "cursorAgentId required" }, { status: 400 });
      }
      return NextResponse.json(
        await ingestCursorAgentReturn({
          cursorAgentId: body.cursorAgentId,
          taskId: body.taskId,
          cursorRunId: body.cursorRunId,
          title: body.title,
          idempotencyKey: body.idempotencyKey,
          forceWaiting: body.forceWaiting,
        }),
      );
    }
    return NextResponse.json(await drainAwaitingCursorLaunches(body.limit));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
