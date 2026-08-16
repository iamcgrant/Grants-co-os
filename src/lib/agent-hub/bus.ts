/**
 * Task / Event Bus — async agent communication.
 */

import { prisma } from "@/lib/db/prisma";
import type { AgentEventKind } from "./types";
import { scrubSecrets } from "./types";

export async function emitEvent(input: {
  kind: AgentEventKind | string;
  taskId?: string;
  agentId?: string;
  payload?: Record<string, unknown>;
}) {
  return prisma.agentEvent.create({
    data: {
      kind: input.kind,
      taskId: input.taskId,
      agentId: input.agentId,
      payloadJson: input.payload ? JSON.stringify(scrubSecrets(input.payload)) : null,
    },
  });
}

export async function appendTranscript(input: {
  taskId?: string;
  agentId?: string;
  role: "CURSOR" | "AGENT" | "SYSTEM" | "OWNER";
  body: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.agentMessage.create({
    data: {
      taskId: input.taskId,
      agentId: input.agentId,
      role: input.role,
      body: input.body,
      metadataJson: input.metadata ? JSON.stringify(scrubSecrets(input.metadata)) : null,
    },
  });
}

export async function createTask(input: {
  type: string;
  title: string;
  prompt: string;
  eventKind?: AgentEventKind | string;
  ownerAgentId?: string;
  assigneeAgentId?: string;
  parentTaskId?: string;
  autonomyLevel?: number;
  priority?: string;
  grantsClientId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}) {
  if (input.idempotencyKey) {
    const existing = await prisma.agentTask.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
  }

  const task = await prisma.agentTask.create({
    data: {
      type: input.type,
      title: input.title,
      prompt: input.prompt,
      eventKind: input.eventKind,
      ownerAgentId: input.ownerAgentId,
      assigneeAgentId: input.assigneeAgentId,
      parentTaskId: input.parentTaskId,
      autonomyLevel: input.autonomyLevel ?? 0,
      priority: input.priority || "NORMAL",
      grantsClientId: input.grantsClientId,
      idempotencyKey: input.idempotencyKey,
      metadataJson: input.metadata ? JSON.stringify(scrubSecrets(input.metadata)) : null,
      status: "QUEUED",
    },
  });

  await emitEvent({
    kind: input.eventKind || "SYSTEM",
    taskId: task.id,
    agentId: input.ownerAgentId,
    payload: { title: input.title, type: input.type },
  });

  return task;
}

export async function updateTaskStatus(
  taskId: string,
  status: string,
  patch?: {
    result?: unknown;
    errorMessage?: string;
    cursorAgentId?: string;
    cursorRunId?: string;
    cursorUrl?: string;
    assigneeAgentId?: string;
  },
) {
  return prisma.agentTask.update({
    where: { id: taskId },
    data: {
      status,
      resultJson: patch?.result !== undefined ? JSON.stringify(scrubSecrets(patch.result)) : undefined,
      errorMessage: patch?.errorMessage,
      cursorAgentId: patch?.cursorAgentId,
      cursorRunId: patch?.cursorRunId,
      cursorUrl: patch?.cursorUrl,
      assigneeAgentId: patch?.assigneeAgentId,
      startedAt: status === "IN_PROGRESS" ? new Date() : undefined,
      completedAt: ["COMPLETED", "FAILED", "CANCELLED", "DENIED"].includes(status)
        ? new Date()
        : undefined,
    },
  });
}

export async function getTask(taskId: string) {
  return prisma.agentTask.findUnique({
    where: { id: taskId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
      ownerAgent: true,
      assigneeAgent: true,
      approvals: true,
    },
  });
}

export async function listRecentEvents(limit = 50) {
  return prisma.agentEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      agent: { select: { id: true, displayName: true, status: true } },
      task: { select: { id: true, title: true, status: true } },
    },
  });
}
