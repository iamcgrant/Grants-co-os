/**
 * Agent Registry — persistent specialist identities.
 */

import { prisma } from "@/lib/db/prisma";
import type { AgentMode, AutonomyLevel } from "./types";

export type AgentSeed = {
  id: string;
  displayName: string;
  role: string;
  mode: AgentMode;
  instructions: string;
  allowedTools: string[];
  deniedTools: string[];
  permissions: string[];
  maxAutonomyLevel: AutonomyLevel;
  scopes: string[];
  metadata?: Record<string, unknown>;
};

export const AGENT_SEEDS: AgentSeed[] = [
  {
    id: "x1-operations",
    displayName: "X1 — Operations",
    role: "Operations / GHL / DisputeFox / workflow systems",
    mode: "GRANTS_NATIVE_AGENT",
    instructions: [
      "You are X1, Grants & Co operations specialist.",
      "Answer GHL, DisputeFox, workflow, and field-mapping questions using Hub capabilities and BusinessFacts.",
      "Never return raw credentials, API keys, tokens, or passwords.",
      "Prefer callable capabilities (lookupGHLContact, get mappings) over rediscovery.",
      "When OS code is missing a mapping or workflow piece, emit CODE_CHANGE_REQUIRED for Cursor — do not ask Charles to relay.",
      "Follow RESOLVE BEFORE ESCALATE. Charles is approval-only for Level 3.",
      "No live client communication. No destructive production actions in development.",
    ].join(" "),
    allowedTools: [
      "get_business_configuration",
      "get_client_mapping",
      "get_ghl_schema",
      "get_disputefox_mapping",
      "get_system_health",
      "route_agent_task",
      "create_code_change_task",
    ],
    deniedTools: [
      "send_live_message",
      "charge_payment",
      "refund_payment",
      "rotate_credentials",
      "delete_client",
      "merge_contacts",
    ],
    permissions: ["READ_GHL", "READ_DISPUTEFOX", "READ_WORKFLOWS", "CREATE_TASKS", "REQUEST_CODE_CHANGE"],
    maxAutonomyLevel: 1,
    scopes: ["ghl", "disputefox", "workflows", "field-mappings", "onboarding"],
    metadata: {
      externalBotStatus: "No supported public API/webhook/MCP detected for legacy chat bot — implemented as GRANTS_NATIVE_AGENT.",
      connectionMode: "GRANTS_NATIVE_AGENT",
    },
  },
  {
    id: "payment-processing",
    displayName: "Payment Processing",
    role: "Payments / processor / settlement / payout architecture",
    mode: "GRANTS_NATIVE_AGENT",
    instructions: [
      "You are the Grants Pay specialist.",
      "Answer settlement, payout, Authorize.Net/Commas adapter, and ledger questions.",
      "Never expose processor secrets. Never charge or refund outside established rules without Level 3 approval.",
      "Distinguish authorization vs settlement vs payout.",
    ].join(" "),
    allowedTools: [
      "get_payment_state",
      "get_business_configuration",
      "get_system_health",
      "route_agent_task",
    ],
    deniedTools: [
      "charge_payment",
      "refund_outside_rules",
      "bank_payout_change",
      "rotate_credentials",
      "send_live_message",
    ],
    permissions: ["READ_PAYMENTS", "READ_SETTLEMENT", "CREATE_TASKS"],
    maxAutonomyLevel: 1,
    scopes: ["payments", "settlement", "payouts", "authorize-net", "commas"],
    metadata: {
      externalBotStatus: "No supported public API for legacy payment chat bot — implemented as GRANTS_NATIVE_AGENT.",
      connectionMode: "GRANTS_NATIVE_AGENT",
    },
  },
  {
    id: "workflow-qa",
    displayName: "Workflow QA",
    role: "QA / regression / PR validation",
    mode: "GRANTS_NATIVE_AGENT",
    instructions:
      "Validate operational results after Cursor changes. Record QA outcomes as BusinessFacts. Escalate failures with WORKFLOW_FAILURE or QA_REQUIRED.",
    allowedTools: ["get_system_health", "get_agent_task_status", "route_agent_task"],
    deniedTools: ["charge_payment", "send_live_message", "rotate_credentials"],
    permissions: ["READ_SYSTEM", "QA", "CREATE_TASKS"],
    maxAutonomyLevel: 1,
    scopes: ["qa", "workflows", "prs"],
    metadata: { connectionMode: "GRANTS_NATIVE_AGENT" },
  },
  {
    id: "cursor-engineering",
    displayName: "Cursor Engineering",
    role: "Code changes, tests, PRs via Cursor Cloud Agents",
    mode: "EXTERNAL_AGENT",
    instructions:
      "Execute CODE_CHANGE_REQUIRED tasks via Cursor Cloud Agents API. Report results back to Agent Hub. Development/test scope by default.",
    allowedTools: ["get_agent_task_status", "report_cursor_result"],
    deniedTools: ["rotate_credentials", "charge_payment", "send_live_message"],
    permissions: ["CODE_CHANGE", "OPEN_PR", "RUN_TESTS"],
    maxAutonomyLevel: 1,
    scopes: ["code", "tests", "prs"],
    metadata: {
      connectionMode: "EXTERNAL_AGENT",
      interface: "Cursor Cloud Agents API (api.cursor.com/v1/agents)",
    },
  },
];

export async function ensureAgentRegistry() {
  for (const seed of AGENT_SEEDS) {
    await prisma.agentDefinition.upsert({
      where: { id: seed.id },
      create: {
        id: seed.id,
        displayName: seed.displayName,
        role: seed.role,
        mode: seed.mode,
        instructions: seed.instructions,
        allowedToolsJson: JSON.stringify(seed.allowedTools),
        deniedToolsJson: JSON.stringify(seed.deniedTools),
        permissionsJson: JSON.stringify(seed.permissions),
        maxAutonomyLevel: seed.maxAutonomyLevel,
        scopesJson: JSON.stringify(seed.scopes),
        status: "IDLE",
        metadataJson: seed.metadata ? JSON.stringify(seed.metadata) : null,
      },
      update: {
        displayName: seed.displayName,
        role: seed.role,
        mode: seed.mode,
        instructions: seed.instructions,
        allowedToolsJson: JSON.stringify(seed.allowedTools),
        deniedToolsJson: JSON.stringify(seed.deniedTools),
        permissionsJson: JSON.stringify(seed.permissions),
        maxAutonomyLevel: seed.maxAutonomyLevel,
        scopesJson: JSON.stringify(seed.scopes),
        metadataJson: seed.metadata ? JSON.stringify(seed.metadata) : null,
      },
    });
  }
  return prisma.agentDefinition.findMany({ orderBy: { id: "asc" } });
}

export async function listAgents() {
  await ensureAgentRegistry();
  return prisma.agentDefinition.findMany({ orderBy: { id: "asc" } });
}

export async function getAgent(id: string) {
  await ensureAgentRegistry();
  return prisma.agentDefinition.findUnique({ where: { id } });
}

export async function setAgentStatus(id: string, status: string, currentTaskId?: string | null) {
  return prisma.agentDefinition.update({
    where: { id },
    data: {
      status,
      currentTaskId: currentTaskId === undefined ? undefined : currentTaskId,
    },
  });
}

export function parseAgentTools(agent: { allowedToolsJson: string; deniedToolsJson: string }) {
  return {
    allowed: JSON.parse(agent.allowedToolsJson) as string[],
    denied: JSON.parse(agent.deniedToolsJson) as string[],
  };
}

export function agentCanUseTool(agent: { allowedToolsJson: string; deniedToolsJson: string }, tool: string) {
  const { allowed, denied } = parseAgentTools(agent);
  if (denied.includes(tool)) return false;
  return allowed.includes(tool) || allowed.includes("*");
}
