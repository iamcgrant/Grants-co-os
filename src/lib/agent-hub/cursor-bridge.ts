/**
 * Cursor bridge — bots → Cursor Cloud Agents API.
 * Secrets stay server-side. Never returned to other agents.
 */

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
  mode: "LIVE" | "QUEUED_AWAITING_KEY" | "SIMULATED";
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
  const simulate =
    input.simulateIfNoKey ||
    process.env.AGENT_HUB_SIMULATE_CURSOR === "true" ||
    process.env.GC_ENV !== "production";

  if (!apiKey) {
    if (simulate && process.env.AGENT_HUB_SIMULATE_CURSOR === "true") {
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
      kind: "OWNER_APPROVAL_REQUIRED",
      taskId: input.taskId,
      agentId: "cursor-engineering",
      payload: {
        reason: "CURSOR_API_KEY missing — needed once for bot→Cursor launches (not a messenger relay)",
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
        "When finished, summarize result. Prefer opening a PR. Do not send live client messages. Do not rotate credentials.",
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
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
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

  // Notify owning agent (e.g. X1) for validation
  return { ok: true, taskId: input.taskId, status: input.status };
}
