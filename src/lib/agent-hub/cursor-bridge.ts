/**
 * Cursor bridge — bots → Cursor Cloud Agents API.
 * Secrets stay server-side. Never returned to other agents.
 */

import { prisma } from "@/lib/db/prisma";
import { appendTranscript, emitEvent, updateTaskStatus } from "./bus";
import { setAgentStatus } from "./registry";
import { scrubSecrets } from "./types";

const CURSOR_API = "https://api.cursor.com/v1";

export function getCursorApiKey(): string | null {
  return process.env.CURSOR_API_KEY?.trim() || null;
}

export function isCursorLaunchReady(): boolean {
  return Boolean(getCursorApiKey());
}

export type LaunchCursorResult = {
  mode: "LIVE" | "QUEUED_AWAITING_KEY" | "SIMULATED" | "IN_PROCESS";
  taskId: string;
  cursorAgentId?: string;
  cursorRunId?: string;
  cursorUrl?: string;
  message: string;
};

function defaultRepoUrl() {
  return (
    process.env.CURSOR_REPO_URL?.trim() ||
    process.env.GITHUB_REPO_URL?.trim() ||
    "https://github.com/iamcgrant/Grants-co-os"
  );
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export async function launchCursorForTask(input: {
  taskId: string;
  title: string;
  prompt: string;
  startingRef?: string;
  autoCreatePR?: boolean;
  simulateIfNoKey?: boolean;
}): Promise<LaunchCursorResult> {
  await setAgentStatus("cursor-engineering", "WORKING", input.taskId);
  await appendTranscript({
    taskId: input.taskId,
    agentId: "cursor-engineering",
    role: "SYSTEM",
    body: `Launching Cursor for: ${input.title}`,
  });

  const apiKey = getCursorApiKey();

  if (!apiKey) {
    if (process.env.AGENT_HUB_SIMULATE_CURSOR === "true") {
      const simulatedId = `sim-bc-${input.taskId.slice(0, 8)}`;
      await updateTaskStatus(input.taskId, "WAITING_CURSOR", {
        cursorAgentId: simulatedId,
        cursorUrl: `https://cursor.com/agents/${simulatedId}`,
        result: {
          mode: "SIMULATED",
          note: "Dev simulation — set CURSOR_API_KEY for live launches",
        },
      });
      await emitEvent({
        kind: "CURSOR_LAUNCHED",
        taskId: input.taskId,
        agentId: "cursor-engineering",
        payload: { mode: "SIMULATED", cursorAgentId: simulatedId },
      });
      await setAgentStatus("cursor-engineering", "WAITING", input.taskId);
      return {
        mode: "SIMULATED",
        taskId: input.taskId,
        cursorAgentId: simulatedId,
        cursorUrl: `https://cursor.com/agents/${simulatedId}`,
        message: "Simulated Cursor launch (AGENT_HUB_SIMULATE_CURSOR=true)",
      };
    }

    await updateTaskStatus(input.taskId, "AWAITING_CURSOR_API_KEY", {
      result: {
        awaiting: "CURSOR_API_KEY",
        promptPreview: input.prompt.slice(0, 500),
      },
    });
    await emitEvent({
      kind: "SYSTEM",
      taskId: input.taskId,
      agentId: "cursor-engineering",
      payload: {
        reason: "CURSOR_API_KEY missing — task queued (not a Charles relay)",
      },
    });
    await setAgentStatus("cursor-engineering", "WAITING", input.taskId);
    return {
      mode: "QUEUED_AWAITING_KEY",
      taskId: input.taskId,
      message:
        "Task queued. Add CURSOR_API_KEY to launch Cloud Agents. Charles is not asked to relay the prompt.",
    };
  }

  const body = {
    prompt: {
      text: [
        `## Grants Agent Hub task`,
        `Task ID: ${input.taskId}`,
        `Title: ${input.title}`,
        "",
        input.prompt,
        "",
        "When finished, summarize result. Prefer opening a PR.",
        "Do not send live client messages. Do not rotate credentials.",
        "Report completion conceptually for Agent Hub (task remains tracked in OS).",
      ].join("\n"),
    },
    name: input.title.slice(0, 100),
    repos: [
      {
        url: defaultRepoUrl(),
        startingRef: input.startingRef || process.env.CURSOR_STARTING_REF || "main",
      },
    ],
    autoCreatePR: input.autoCreatePR ?? true,
  };

  const res = await fetch(`${CURSOR_API}/agents`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    await updateTaskStatus(input.taskId, "FAILED", {
      errorMessage: `Cursor API ${res.status}: ${text.slice(0, 300)}`,
    });
    await setAgentStatus("cursor-engineering", "ERROR", input.taskId);
    throw new Error(`Cursor launch failed (${res.status})`);
  }

  const data = JSON.parse(text) as {
    agent?: { id?: string; url?: string };
    run?: { id?: string };
  };

  const cursorAgentId = data.agent?.id;
  const cursorRunId = data.run?.id;
  const cursorUrl = data.agent?.url;

  await updateTaskStatus(input.taskId, "WAITING_CURSOR", {
    cursorAgentId,
    cursorRunId,
    cursorUrl,
  });
  await emitEvent({
    kind: "CURSOR_LAUNCHED",
    taskId: input.taskId,
    agentId: "cursor-engineering",
    payload: { cursorAgentId, cursorRunId, cursorUrl },
  });
  await appendTranscript({
    taskId: input.taskId,
    agentId: "cursor-engineering",
    role: "SYSTEM",
    body: `Cursor agent launched: ${cursorUrl || cursorAgentId}`,
  });
  await setAgentStatus("cursor-engineering", "WAITING", input.taskId);

  return {
    mode: "LIVE",
    taskId: input.taskId,
    cursorAgentId,
    cursorRunId,
    cursorUrl,
    message: "Cursor Cloud Agent launched",
  };
}

/**
 * Drain tasks waiting for CURSOR_API_KEY once the secret is present.
 */
export async function drainAwaitingCursorLaunches(limit = 10) {
  if (!isCursorLaunchReady()) {
    return {
      ready: false,
      drained: [] as LaunchCursorResult[],
      message: "CURSOR_API_KEY still not available in this process",
    };
  }

  const queued = await prisma.agentTask.findMany({
    where: { status: "AWAITING_CURSOR_API_KEY" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const drained: LaunchCursorResult[] = [];
  for (const task of queued) {
    const result = await launchCursorForTask({
      taskId: task.id,
      title: task.title,
      prompt: task.prompt,
    });
    drained.push(result);
  }

  return { ready: true, drained, count: drained.length };
}

export async function getCursorAgentStatus(cursorAgentId: string) {
  const apiKey = getCursorApiKey();
  if (!apiKey) {
    return { ready: false, message: "CURSOR_API_KEY not configured" };
  }

  const res = await fetch(`${CURSOR_API}/agents/${encodeURIComponent(cursorAgentId)}`, {
    headers: authHeaders(apiKey),
  });
  const text = await res.text();
  if (!res.ok) {
    return { ready: true, ok: false, status: res.status, body: text.slice(0, 400) };
  }
  const data = JSON.parse(text) as Record<string, unknown>;
  return scrubSecrets({ ready: true, ok: true, agent: data });
}

export async function getCursorRunStatus(cursorAgentId: string, runId: string) {
  const apiKey = getCursorApiKey();
  if (!apiKey) {
    return { ready: false, message: "CURSOR_API_KEY not configured" };
  }

  const res = await fetch(
    `${CURSOR_API}/agents/${encodeURIComponent(cursorAgentId)}/runs/${encodeURIComponent(runId)}`,
    { headers: authHeaders(apiKey) },
  );
  const text = await res.text();
  if (!res.ok) {
    return { ready: true, ok: false, status: res.status, body: text.slice(0, 400) };
  }
  return scrubSecrets({ ready: true, ok: true, run: JSON.parse(text) });
}

/**
 * Sync WAITING_CURSOR tasks with Cloud Agents API run status when possible.
 */
export async function syncWaitingCursorTasks(limit = 20) {
  if (!isCursorLaunchReady()) {
    return { ready: false, updated: 0 };
  }

  const waiting = await prisma.agentTask.findMany({
    where: { status: "WAITING_CURSOR", cursorAgentId: { not: null } },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });

  let updated = 0;
  for (const task of waiting) {
    if (!task.cursorAgentId) continue;
    if (task.cursorAgentId.startsWith("sim-")) continue;

    if (task.cursorRunId) {
      const run = await getCursorRunStatus(task.cursorAgentId, task.cursorRunId);
      const status =
        run && typeof run === "object" && "run" in run
          ? String((run.run as { status?: string })?.status || "")
          : "";
      if (/COMPLETE|FINISHED|SUCCEEDED/i.test(status)) {
        await reportCursorResult({
          taskId: task.id,
          status: "COMPLETED",
          summary: `Cursor run ${task.cursorRunId} reported ${status}`,
          metadata: { syncedFromApi: true },
        });
        updated += 1;
      } else if (/FAIL|ERROR|CANCEL/i.test(status)) {
        await reportCursorResult({
          taskId: task.id,
          status: "FAILED",
          summary: `Cursor run ${task.cursorRunId} reported ${status}`,
          metadata: { syncedFromApi: true },
        });
        updated += 1;
      }
    }
  }

  return { ready: true, checked: waiting.length, updated };
}

export async function reportCursorResult(input: {
  taskId: string;
  status: "COMPLETED" | "FAILED";
  summary: string;
  prUrl?: string;
  branch?: string;
  metadata?: Record<string, unknown>;
}) {
  await updateTaskStatus(input.taskId, input.status, {
    result: scrubSecrets({
      summary: input.summary,
      prUrl: input.prUrl,
      branch: input.branch,
      ...(input.metadata || {}),
    }),
    errorMessage: input.status === "FAILED" ? input.summary : undefined,
  });
  await emitEvent({
    kind: "CURSOR_RESULT",
    taskId: input.taskId,
    agentId: "cursor-engineering",
    payload: { status: input.status, prUrl: input.prUrl },
  });
  await appendTranscript({
    taskId: input.taskId,
    agentId: "cursor-engineering",
    role: "AGENT",
    body: input.summary,
  });
  await setAgentStatus("cursor-engineering", input.status === "COMPLETED" ? "IDLE" : "ERROR", null);

  return { ok: true, taskId: input.taskId, status: input.status };
}

/** Verify API key works against Cursor /v1/me without exposing it. */
export async function probeCursorApiKey() {
  const apiKey = getCursorApiKey();
  if (!apiKey) {
    return { present: false, valid: false, message: "CURSOR_API_KEY not in process env" };
  }
  try {
    const res = await fetch(`${CURSOR_API}/me`, { headers: authHeaders(apiKey) });
    if (!res.ok) {
      return { present: true, valid: false, httpStatus: res.status, message: "API key rejected" };
    }
    const data = (await res.json()) as { email?: string; name?: string };
    return {
      present: true,
      valid: true,
      // Never return email raw to other agents in logs if sensitive — owner-facing only
      accountHint: data.email ? `${data.email.slice(0, 2)}…` : data.name || "ok",
    };
  } catch (e) {
    return {
      present: true,
      valid: false,
      message: e instanceof Error ? e.message : "probe failed",
    };
  }
}
