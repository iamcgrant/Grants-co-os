/**
 * Agent Control Center data for Owner observability.
 */

import { prisma } from "@/lib/db/prisma";
import { bootstrapAgentHub } from "./orchestrator";
import { listPendingApprovals } from "./approvals";
import { isCursorLaunchReady } from "./cursor-bridge";
import { startCursorReturnPoller } from "./cursor-poller";
import { getGcEnvironment } from "@/lib/integrations/env";
import { isGhlApiReady } from "@/lib/integrations/ghl/http";

export async function getControlCenterSnapshot() {
  await bootstrapAgentHub();
  startCursorReturnPoller();

  const [agents, activeTasks, recentTasks, recentEvents, approvals, recentMessages] =
    await Promise.all([
      prisma.agentDefinition.findMany({ orderBy: { id: "asc" } }),
      prisma.agentTask.findMany({
        where: {
          status: {
            in: [
              "QUEUED",
              "ROUTING",
              "IN_PROGRESS",
              "WAITING_AGENT",
              "WAITING_CURSOR",
              "AWAITING_CURSOR_API_KEY",
              "AWAITING_APPROVAL",
            ],
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 40,
        include: {
          assigneeAgent: { select: { id: true, displayName: true } },
          ownerAgent: { select: { id: true, displayName: true } },
        },
      }),
      prisma.agentTask.findMany({
        where: { status: { in: ["COMPLETED", "FAILED", "DENIED", "CANCELLED"] } },
        orderBy: { completedAt: "desc" },
        take: 20,
      }),
      prisma.agentEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 40,
        include: {
          agent: { select: { displayName: true } },
          task: { select: { title: true } },
        },
      }),
      listPendingApprovals(),
      prisma.agentMessage.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { agent: { select: { displayName: true } } },
      }),
    ]);

  return {
    dataPlane: getGcEnvironment(),
    bridges: {
      ghl: isGhlApiReady() ? "READY" : "AWAITING_INTEGRATION",
      cursorLaunch: isCursorLaunchReady() ? "READY" : "AWAITING_CURSOR_API_KEY",
    },
    agents: agents.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      role: a.role,
      mode: a.mode,
      status: a.status,
      currentTaskId: a.currentTaskId,
      maxAutonomyLevel: a.maxAutonomyLevel,
    })),
    activeTasks,
    completedTasks: recentTasks,
    events: recentEvents,
    approvals,
    handoffs: recentMessages.filter((m) => m.role === "AGENT" || m.role === "CURSOR").slice(0, 20),
    policy: "RESOLVE_BEFORE_ESCALATE",
  };
}
