/**
 * Owner approval cards — Charles sees What / Why / Agent / Risk / Approve|Deny.
 */

import { prisma } from "@/lib/db/prisma";
import { emitEvent, updateTaskStatus, appendTranscript } from "./bus";

export async function requestOwnerApproval(input: {
  taskId?: string;
  agentId?: string;
  title: string;
  what: string;
  why: string;
  risk: string;
}) {
  const approval = await prisma.ownerApproval.create({
    data: {
      taskId: input.taskId,
      agentId: input.agentId,
      title: input.title,
      what: input.what,
      why: input.why,
      risk: input.risk,
      status: "PENDING",
    },
  });

  if (input.taskId) {
    await updateTaskStatus(input.taskId, "AWAITING_APPROVAL");
    await appendTranscript({
      taskId: input.taskId,
      agentId: input.agentId,
      role: "SYSTEM",
      body: `Owner approval requested: ${input.title}`,
    });
  }

  await emitEvent({
    kind: "OWNER_APPROVAL_REQUIRED",
    taskId: input.taskId,
    agentId: input.agentId,
    payload: { approvalId: approval.id, title: input.title },
  });

  return approval;
}

export async function decideApproval(input: {
  approvalId: string;
  decision: "APPROVED" | "DENIED";
  decidedById?: string;
  note?: string;
}) {
  const approval = await prisma.ownerApproval.update({
    where: { id: input.approvalId },
    data: {
      status: input.decision,
      decidedById: input.decidedById,
      decidedAt: new Date(),
      decisionNote: input.note,
    },
  });

  if (approval.taskId) {
    await updateTaskStatus(
      approval.taskId,
      input.decision === "APPROVED" ? "QUEUED" : "DENIED",
    );
    await appendTranscript({
      taskId: approval.taskId,
      role: "OWNER",
      body: `${input.decision}${input.note ? `: ${input.note}` : ""}`,
    });
  }

  return approval;
}

export async function listPendingApprovals() {
  return prisma.ownerApproval.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      agent: { select: { id: true, displayName: true } },
      task: { select: { id: true, title: true, status: true } },
    },
  });
}
