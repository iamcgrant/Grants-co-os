/**
 * Agent Orchestrator — route tasks to specialists. RESOLVE BEFORE ESCALATE.
 */

import { askX1 } from "./agents/x1";
import { askPaymentProcessing } from "./agents/payment";
import { createTask, appendTranscript, updateTaskStatus, getTask } from "./bus";
import { ensureAgentRegistry, listAgents, getAgent } from "./registry";
import { ensureBusinessFacts, getBusinessConfiguration } from "./context";
import { launchCursorForTask } from "./cursor-bridge";
import {
  getSystemHealth,
  getClientMapping,
  getGhlSchema,
  getDisputeFoxMapping,
  getPaymentState,
} from "./capabilities";
import { requestOwnerApproval } from "./approvals";
import { requiresOwnerApproval, type AutonomyLevel, scrubSecrets } from "./types";

export async function bootstrapAgentHub() {
  await ensureAgentRegistry();
  await ensureBusinessFacts();
}

export function routeAgentId(question: string): string {
  const q = question.toLowerCase();
  if (/pay|settlement|payout|invoice|authorize\.net|commas|refund|charge/i.test(q)) {
    return "payment-processing";
  }
  if (/qa|pull request|regress|validate pr/i.test(q)) {
    return "workflow-qa";
  }
  if (/code change|implement|fix client 360|add mapping to os/i.test(q)) {
    return "cursor-engineering";
  }
  // Default operations / GHL / DisputeFox / workflows → X1
  return "x1-operations";
}

export async function routeAndAsk(input: {
  question: string;
  preferredAgentId?: string;
  fromRole?: "CURSOR" | "AGENT" | "SYSTEM" | "OWNER";
  autonomyLevel?: AutonomyLevel;
  actionCode?: string;
}) {
  await bootstrapAgentHub();

  if (input.actionCode && requiresOwnerApproval(input.actionCode, input.autonomyLevel ?? 0)) {
    const task = await createTask({
      type: "APPROVAL",
      eventKind: "OWNER_APPROVAL_REQUIRED",
      title: `Approval: ${input.actionCode}`,
      prompt: input.question,
      autonomyLevel: 3,
      ownerAgentId: input.preferredAgentId || "x1-operations",
    });
    const approval = await requestOwnerApproval({
      taskId: task.id,
      agentId: input.preferredAgentId || "x1-operations",
      title: `Approval required: ${input.actionCode}`,
      what: input.question,
      why: "Action is Level 3 — owner approval required by policy",
      risk: "Production / money / security impact",
    });
    return {
      escalated: true as const,
      taskId: task.id,
      approvalId: approval.id,
      message: "OWNER_APPROVAL_REQUIRED — Charles receives one approval card (not a relay question).",
    };
  }

  const agentId = input.preferredAgentId || routeAgentId(input.question);
  const task = await createTask({
    type: "ASK",
    title: input.question.slice(0, 120),
    prompt: input.question,
    ownerAgentId: "cursor-engineering",
    assigneeAgentId: agentId,
    autonomyLevel: input.autonomyLevel ?? 0,
  });

  await appendTranscript({
    taskId: task.id,
    role: input.fromRole || "CURSOR",
    body: input.question,
  });
  await updateTaskStatus(task.id, "ROUTING", { assigneeAgentId: agentId });

  let result: unknown;
  if (agentId === "payment-processing") {
    result = await askPaymentProcessing({ question: input.question, taskId: task.id });
  } else if (agentId === "cursor-engineering") {
    const launch = await launchCursorForTask({
      taskId: task.id,
      title: input.question.slice(0, 100),
      prompt: input.question,
    });
    result = launch;
  } else {
    result = await askX1({
      question: input.question,
      taskId: task.id,
      fromRole: input.fromRole || "CURSOR",
    });
  }

  // If X1 created a CODE_CHANGE child task, auto-dispatch to Cursor
  const refreshed = await getTask(task.id);
  const codeChangeId =
    result && typeof result === "object" && "codeChangeTaskId" in result
      ? String((result as { codeChangeTaskId?: string }).codeChangeTaskId)
      : undefined;

  let cursorLaunch = null;
  if (codeChangeId) {
    const codeTask = await getTask(codeChangeId);
    if (codeTask) {
      cursorLaunch = await launchCursorForTask({
        taskId: codeTask.id,
        title: codeTask.title,
        prompt: codeTask.prompt,
      });
    }
  }

  return {
    escalated: false as const,
    taskId: task.id,
    agentId,
    result: scrubSecrets(result),
    cursorLaunch,
    transcriptCount: refreshed?.messages.length ?? 0,
  };
}

export async function createCodeChangeAndLaunch(input: {
  title: string;
  prompt: string;
  ownerAgentId?: string;
  idempotencyKey?: string;
}) {
  await bootstrapAgentHub();
  const task = await createTask({
    type: "CODE_CHANGE_REQUIRED",
    eventKind: "CODE_CHANGE_REQUIRED",
    title: input.title,
    prompt: input.prompt,
    ownerAgentId: input.ownerAgentId || "x1-operations",
    assigneeAgentId: "cursor-engineering",
    autonomyLevel: 1,
    idempotencyKey: input.idempotencyKey,
  });
  const launch = await launchCursorForTask({
    taskId: task.id,
    title: input.title,
    prompt: input.prompt,
  });
  return { task, launch };
}

export async function getAgentCapabilities(agentId?: string) {
  await bootstrapAgentHub();
  if (agentId) {
    const agent = await getAgent(agentId);
    if (!agent) return { found: false };
    return {
      found: true,
      id: agent.id,
      displayName: agent.displayName,
      role: agent.role,
      mode: agent.mode,
      status: agent.status,
      maxAutonomyLevel: agent.maxAutonomyLevel,
      allowedTools: JSON.parse(agent.allowedToolsJson),
      deniedTools: JSON.parse(agent.deniedToolsJson),
      permissions: JSON.parse(agent.permissionsJson),
      scopes: JSON.parse(agent.scopesJson),
      metadata: agent.metadataJson ? JSON.parse(agent.metadataJson) : null,
    };
  }
  const agents = await listAgents();
  return {
    agents: agents.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      role: a.role,
      mode: a.mode,
      status: a.status,
      scopes: JSON.parse(a.scopesJson),
      maxAutonomyLevel: a.maxAutonomyLevel,
    })),
  };
}

export {
  getBusinessConfiguration,
  getSystemHealth,
  getClientMapping,
  getGhlSchema,
  getDisputeFoxMapping,
  getPaymentState,
};
