/**
 * Cursor bridge — bots → Cursor Cloud Agents API.
 * Secrets stay server-side. Never returned to other agents.
 */

import { prisma } from "@/lib/db/prisma";
import { appendTranscript, emitEvent, updateTaskStatus } from "./bus";
import { setAgentStatus } from "./registry";
import { scrubSecrets } from "./types";

const CURSOR_API = "https://api.cursor.com/v1";

/**
 * Cursor Cloud Agent API rejects session env names that start with `CURSOR_`.
 * Dashboard Runtime Secrets with that prefix often never reach process.env.
 * Prefer AGENT_HUB_CURSOR_API_KEY on Cloud Agent VMs; keep CURSOR_API_KEY for local.
 */
export const CURSOR_API_KEY_ENV_NAMES = [
  "AGENT_HUB_CURSOR_API_KEY",
  "CURSOR_API_KEY",
] as const;

export function getCursorApiKeySource(): { name: (typeof CURSOR_API_KEY_ENV_NAMES)[number]; present: true } | null {
  for (const name of CURSOR_API_KEY_ENV_NAMES) {
    const value = process.env[name]?.trim();
    if (value) return { name, present: true };
  }
  return null;
}

export function getCursorApiKey(): string | null {
  for (const name of CURSOR_API_KEY_ENV_NAMES) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
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
    process.env.AGENT_HUB_CURSOR_REPO_URL?.trim() ||
    process.env.CURSOR_REPO_URL?.trim() ||
    process.env.GITHUB_REPO_URL?.trim() ||
    "https://github.com/iamcgrant/Grants-co-os"
  );
}

function defaultStartingRef() {
  return (
    process.env.AGENT_HUB_CURSOR_STARTING_REF?.trim() ||
    process.env.CURSOR_STARTING_REF?.trim() ||
    "main"
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
        "Task queued. Add AGENT_HUB_CURSOR_API_KEY (or CURSOR_API_KEY locally) so this process can launch Cloud Agents. Charles is not asked to relay the prompt.",
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
        startingRef: input.startingRef || defaultStartingRef(),
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
      message:
        "AGENT_HUB_CURSOR_API_KEY / CURSOR_API_KEY still not available in this process",
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

export type CursorAgentSnapshot = {
  id?: string;
  name?: string;
  status?: string;
  url?: string;
  latestRunId?: string;
};

export type CursorRunSnapshot = {
  id?: string;
  agentId?: string;
  status?: string;
  result?: string;
  git?: {
    branches?: Array<{
      repoUrl?: string;
      branch?: string;
      prUrl?: string;
    }>;
  };
};

export function classifyCursorRunStatus(
  status: string | undefined | null,
): "COMPLETED" | "FAILED" | "RUNNING" {
  const s = (status || "").trim().toUpperCase();
  if (s === "FINISHED" || s === "COMPLETED" || s === "SUCCEEDED") return "COMPLETED";
  if (s === "ERROR" || s === "FAILED" || s === "CANCELLED" || s === "CANCELED" || s === "EXPIRED") {
    return "FAILED";
  }
  return "RUNNING";
}

export function extractCursorGit(run: CursorRunSnapshot | null | undefined) {
  const branches = run?.git?.branches ?? [];
  const withPr = branches.find((b) => b.prUrl);
  const chosen = withPr || branches[0];
  return {
    prUrl: chosen?.prUrl,
    branch: chosen?.branch,
  };
}

function asAgentSnapshot(value: unknown): CursorAgentSnapshot | null {
  if (!value || typeof value !== "object") return null;
  return value as CursorAgentSnapshot;
}

function asRunSnapshot(value: unknown): CursorRunSnapshot | null {
  if (!value || typeof value !== "object") return null;
  return value as CursorRunSnapshot;
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

async function resolveCursorRun(cursorAgentId: string, storedRunId?: string | null) {
  const agentLookup = await getCursorAgentStatus(cursorAgentId);
  const agent =
    agentLookup && typeof agentLookup === "object" && "agent" in agentLookup
      ? asAgentSnapshot(agentLookup.agent)
      : null;
  const candidates = [storedRunId, agent?.latestRunId].filter(
    (id, index, all): id is string => Boolean(id) && all.indexOf(id) === index,
  );

  let run: CursorRunSnapshot | null = null;
  let runId: string | null = null;
  for (const candidate of candidates) {
    const lookup = await getCursorRunStatus(cursorAgentId, candidate);
    if (lookup && typeof lookup === "object" && "run" in lookup && lookup.ok) {
      run = asRunSnapshot(lookup.run);
      runId = candidate;
      if (run?.status) break;
    }
  }

  return { agent, run, runId };
}

export type SyncCursorTaskResult = {
  taskId: string;
  cursorAgentId: string;
  runId: string | null;
  runStatus: string | null;
  outcome: "COMPLETED" | "FAILED" | "RUNNING" | "SKIPPED";
  prUrl?: string;
  branch?: string;
};

async function applyCursorRunToTask(task: {
  id: string;
  cursorAgentId: string | null;
  cursorRunId: string | null;
}): Promise<SyncCursorTaskResult> {
  const cursorAgentId = task.cursorAgentId!;
  const resolved = await resolveCursorRun(cursorAgentId, task.cursorRunId);
  const runStatus = resolved.run?.status || null;
  const outcome = classifyCursorRunStatus(runStatus);
  const git = extractCursorGit(resolved.run);
  const summary =
    resolved.run?.result?.trim() ||
    (runStatus
      ? `Cursor run ${resolved.runId || task.cursorRunId || "unknown"} reported ${runStatus}`
      : "Cursor run status unavailable");

  if (resolved.runId && resolved.runId !== task.cursorRunId) {
    await updateTaskStatus(task.id, "WAITING_CURSOR", {
      cursorRunId: resolved.runId,
      cursorUrl: resolved.agent?.url || `https://cursor.com/agents/${cursorAgentId}`,
    });
  }

  if (outcome === "RUNNING") {
    return {
      taskId: task.id,
      cursorAgentId,
      runId: resolved.runId,
      runStatus,
      outcome,
      prUrl: git.prUrl,
      branch: git.branch,
    };
  }

  await reportCursorResult({
    taskId: task.id,
    status: outcome,
    summary,
    prUrl: git.prUrl,
    branch: git.branch,
    metadata: {
      syncedFromApi: true,
      cursorAgentId,
      cursorRunId: resolved.runId,
      cursorRunStatus: runStatus,
    },
  });

  return {
    taskId: task.id,
    cursorAgentId,
    runId: resolved.runId,
    runStatus,
    outcome,
    prUrl: git.prUrl,
    branch: git.branch,
  };
}

/**
 * Attach a known Cloud Agent to a Hub task so the return poller can record it.
 * Used to recover a launch that already happened (same Hub, not a second one).
 */
export async function trackCursorAgent(input: {
  cursorAgentId: string;
  taskId?: string;
  cursorRunId?: string;
  title?: string;
  prompt?: string;
  idempotencyKey?: string;
  forceWaiting?: boolean;
}) {
  if (input.cursorAgentId.startsWith("sim-")) {
    throw new Error("Refusing to track a simulated Cursor agent");
  }

  let task = input.taskId
    ? await prisma.agentTask.findUnique({ where: { id: input.taskId } })
    : await prisma.agentTask.findFirst({
        where: { cursorAgentId: input.cursorAgentId },
        orderBy: { updatedAt: "desc" },
      });

  if (!task && input.idempotencyKey) {
    task = await prisma.agentTask.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  }

  const cursorUrl = `https://cursor.com/agents/${input.cursorAgentId}`;

  if (!task) {
    task = await prisma.agentTask.create({
      data: {
        ...(input.taskId ? { id: input.taskId } : {}),
        type: "CODE_CHANGE_REQUIRED",
        eventKind: "CODE_CHANGE_REQUIRED",
        title: input.title || `Cursor return ${input.cursorAgentId}`,
        prompt:
          input.prompt ||
          "Imported existing Cursor Cloud Agent so Agent Hub can record completion without a human relay.",
        status: "WAITING_CURSOR",
        ownerAgentId: "x1-operations",
        assigneeAgentId: "cursor-engineering",
        cursorAgentId: input.cursorAgentId,
        cursorRunId: input.cursorRunId,
        cursorUrl,
        idempotencyKey: input.idempotencyKey,
        autonomyLevel: 1,
        metadataJson: JSON.stringify({ trackedFromReturnPath: true }),
      },
    });
    await emitEvent({
      kind: "CURSOR_LAUNCHED",
      taskId: task.id,
      agentId: "cursor-engineering",
      payload: { cursorAgentId: input.cursorAgentId, tracked: true },
    });
    return task;
  }

  const shouldReset = input.forceWaiting || !["COMPLETED", "FAILED", "DENIED", "CANCELLED"].includes(task.status);
  if (shouldReset || !task.cursorAgentId) {
    task = await prisma.agentTask.update({
      where: { id: task.id },
      data: {
        cursorAgentId: input.cursorAgentId,
        cursorRunId: input.cursorRunId ?? task.cursorRunId,
        cursorUrl: task.cursorUrl || cursorUrl,
        status: shouldReset ? "WAITING_CURSOR" : task.status,
        assigneeAgentId: task.assigneeAgentId || "cursor-engineering",
      },
    });
  }

  return task;
}

/**
 * Poll Cloud Agents API for WAITING_CURSOR tasks and write FINISHED/ERROR
 * back into Hub (PR URL + run result). v1 has no webhooks — this is the return path.
 */
export async function syncWaitingCursorTasks(limit = 20) {
  if (!isCursorLaunchReady()) {
    return { ready: false, updated: 0, checked: 0, results: [] as SyncCursorTaskResult[] };
  }

  const waiting = await prisma.agentTask.findMany({
    where: { status: "WAITING_CURSOR", cursorAgentId: { not: null } },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });

  const results: SyncCursorTaskResult[] = [];
  let updated = 0;
  for (const task of waiting) {
    if (!task.cursorAgentId) continue;
    if (task.cursorAgentId.startsWith("sim-")) continue;
    const result = await applyCursorRunToTask(task);
    results.push(result);
    if (result.outcome === "COMPLETED" || result.outcome === "FAILED") updated += 1;
  }

  return { ready: true, checked: waiting.length, updated, results };
}

/** Track one Cloud Agent (if needed) and sync its terminal state into Hub. */
export async function ingestCursorAgentReturn(input: {
  cursorAgentId: string;
  taskId?: string;
  cursorRunId?: string;
  title?: string;
  prompt?: string;
  idempotencyKey?: string;
  forceWaiting?: boolean;
}) {
  const task = await trackCursorAgent(input);
  if (["COMPLETED", "FAILED"].includes(task.status) && !input.forceWaiting) {
    return {
      ready: true,
      alreadyTerminal: true,
      taskId: task.id,
      status: task.status,
      result: task.resultJson ? JSON.parse(task.resultJson) : null,
    };
  }
  const sync = await applyCursorRunToTask(task);
  const refreshed = await prisma.agentTask.findUnique({ where: { id: task.id } });
  return {
    ready: true,
    alreadyTerminal: false,
    taskId: task.id,
    status: refreshed?.status,
    result: refreshed?.resultJson ? JSON.parse(refreshed.resultJson) : null,
    sync,
  };
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
    return {
      present: false,
      valid: false,
      checkedNames: [...CURSOR_API_KEY_ENV_NAMES],
      message: "No Cursor API key in process env (AGENT_HUB_CURSOR_API_KEY or CURSOR_API_KEY)",
    };
  }
  const source = getCursorApiKeySource();
  try {
    const res = await fetch(`${CURSOR_API}/me`, { headers: authHeaders(apiKey) });
    if (!res.ok) {
      return {
        present: true,
        valid: false,
        sourceName: source?.name,
        httpStatus: res.status,
        message: "API key rejected",
      };
    }
    const data = (await res.json()) as { email?: string; name?: string };
    return {
      present: true,
      valid: true,
      sourceName: source?.name,
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
