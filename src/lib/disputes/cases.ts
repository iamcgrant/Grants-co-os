import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import {
  channelCatalog,
  isDisputeChannel,
  nextDisputeStatus,
  type DisputeCaseStatus,
  type DisputeChannel,
} from "@/lib/disputes/channels";

export class DisputeCaseError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "DisputeCaseError";
  }
}

function asStatus(value: string): DisputeCaseStatus {
  switch (value) {
    case "INTAKE":
    case "PACKET":
    case "READY":
    case "SUBMITTED":
    case "RESULTS":
    case "CLOSED":
      return value;
    default:
      throw new DisputeCaseError(`Unknown case status ${value}`);
  }
}

export async function listCasesForChannel(channel: DisputeChannel) {
  return prisma.disputeCase.findMany({
    where: { channel },
    include: {
      client: { select: { grantsClientId: true, firstName: true, lastName: true, stage: true } },
      items: true,
      checklist: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export async function getCaseById(id: string) {
  const row = await prisma.disputeCase.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          grantsClientId: true,
          firstName: true,
          lastName: true,
          stage: true,
          identifiers: { where: { provider: "DISPUTEFOX" }, take: 1 },
        },
      },
      items: { orderBy: { createdAt: "asc" } },
      checklist: { orderBy: { sortOrder: "asc" } },
      actor: { select: { firstName: true, lastName: true } },
    },
  });
  if (!row) throw new DisputeCaseError("Case not found", 404);
  if (!isDisputeChannel(row.channel)) throw new DisputeCaseError("Unknown channel", 400);
  return row;
}

export async function createCase(input: {
  clientId: string;
  channel: DisputeChannel;
  title?: string;
  actorId?: string;
}) {
  const catalog = channelCatalog(input.channel);
  const client = await prisma.client.findFirst({
    where: { OR: [{ id: input.clientId }, { grantsClientId: input.clientId }] },
    select: { id: true, firstName: true, lastName: true, grantsClientId: true },
  });
  if (!client) throw new DisputeCaseError("Client not found", 404);

  const existing = await prisma.disputeCase.findFirst({
    where: { clientId: client.id, channel: input.channel, status: { not: "CLOSED" } },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return getCaseById(existing.id);

  const created = await prisma.disputeCase.create({
    data: {
      clientId: client.id,
      channel: input.channel,
      title: input.title?.trim() || `${catalog.label} case · ${client.grantsClientId}`,
      actorId: input.actorId,
      checklist: {
        create: catalog.checklist.map((item, index) => ({
          key: item.key,
          label: item.label,
          required: item.required,
          sortOrder: index,
        })),
      },
    },
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "DISPUTE_CASE_OPENED",
    entityType: "DisputeCase",
    entityId: created.id,
    metadata: { channel: input.channel, grantsClientId: client.grantsClientId },
  });

  return getCaseById(created.id);
}

export async function getOpenCaseForClient(clientId: string, channel: DisputeChannel) {
  const client = await prisma.client.findFirst({
    where: { OR: [{ id: clientId }, { grantsClientId: clientId }] },
    select: { id: true },
  });
  if (!client) throw new DisputeCaseError("Client not found", 404);
  const existing = await prisma.disputeCase.findFirst({
    where: { clientId: client.id, channel, status: { not: "CLOSED" } },
    orderBy: { updatedAt: "desc" },
  });
  return existing ? getCaseById(existing.id) : null;
}

export async function addCaseItem(input: {
  caseId: string;
  label: string;
  bureau?: string;
  accountRef?: string;
  reason?: string;
  actorId?: string;
}) {
  const current = await getCaseById(input.caseId);
  if (asStatus(current.status) === "CLOSED") throw new DisputeCaseError("Closed case cannot take items");
  const label = input.label.trim();
  if (!label) throw new DisputeCaseError("Item label is required");

  await prisma.disputeCaseItem.create({
    data: {
      caseId: current.id,
      label,
      bureau: input.bureau?.trim() || null,
      accountRef: input.accountRef?.trim() || null,
      reason: input.reason?.trim() || null,
    },
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "DISPUTE_CASE_ITEM_ADDED",
    entityType: "DisputeCase",
    entityId: current.id,
    metadata: { label },
  });

  return getCaseById(current.id);
}

export async function setChecklistItem(input: {
  caseId: string;
  key: string;
  done: boolean;
  actorId?: string;
}) {
  const current = await getCaseById(input.caseId);
  const row = current.checklist.find((item) => item.key === input.key);
  if (!row) throw new DisputeCaseError("Checklist item not found", 404);

  await prisma.disputeCaseCheckItem.update({
    where: { id: row.id },
    data: {
      done: input.done,
      doneAt: input.done ? new Date() : null,
      doneById: input.done ? input.actorId || null : null,
    },
  });

  return getCaseById(current.id);
}

export async function updatePacketNotes(input: { caseId: string; packetNotes: string; actorId?: string }) {
  const current = await getCaseById(input.caseId);
  await prisma.disputeCase.update({
    where: { id: current.id },
    data: { packetNotes: input.packetNotes, actorId: input.actorId || current.actorId },
  });
  return getCaseById(current.id);
}

function requiredChecklistComplete(caseRow: Awaited<ReturnType<typeof getCaseById>>): boolean {
  return caseRow.checklist.filter((item) => item.required).every((item) => item.done);
}

export async function advanceCase(input: {
  caseId: string;
  actorId?: string;
  externalRef?: string;
  outcome?: string;
  outcomeNote?: string;
}) {
  const current = await getCaseById(input.caseId);
  const status = asStatus(current.status);
  const next = nextDisputeStatus(status);
  if (!next) throw new DisputeCaseError("Case is already closed");

  if (next === "PACKET" && current.items.length === 0 && !current.packetNotes?.trim()) {
    throw new DisputeCaseError("Add items or packet notes before moving to Packet");
  }
  if (next === "READY" && !requiredChecklistComplete(current)) {
    throw new DisputeCaseError("Complete required checklist items before Ready");
  }
  if (next === "RESULTS" && !input.outcome?.trim() && !current.outcome?.trim()) {
    throw new DisputeCaseError("Record an outcome before Results");
  }

  const now = new Date();
  await prisma.disputeCase.update({
    where: { id: current.id },
    data: {
      status: next,
      actorId: input.actorId || current.actorId,
      externalRef: input.externalRef?.trim() || current.externalRef,
      outcome: input.outcome?.trim() || current.outcome,
      outcomeNote: input.outcomeNote?.trim() || current.outcomeNote,
      packetReadyAt: next === "PACKET" ? now : current.packetReadyAt,
      readyAt: next === "READY" ? now : current.readyAt,
      submittedAt: next === "SUBMITTED" ? now : current.submittedAt,
      resultsAt: next === "RESULTS" ? now : current.resultsAt,
      closedAt: next === "CLOSED" ? now : current.closedAt,
    },
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: `DISPUTE_CASE_${next}`,
    entityType: "DisputeCase",
    entityId: current.id,
    metadata: { from: status, to: next },
  });

  return getCaseById(current.id);
}

export async function listDisputeFoxBoard() {
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { identifiers: { some: { provider: "DISPUTEFOX" } } },
        { disputeRounds: { some: {} } },
        { disputeCases: { some: { channel: "DISPUTEFOX" } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
    select: {
      id: true,
      grantsClientId: true,
      firstName: true,
      lastName: true,
      stage: true,
      nextAction: true,
      identifiers: { where: { provider: "DISPUTEFOX" }, take: 1, select: { externalId: true } },
      disputeRounds: { orderBy: { roundNumber: "desc" }, take: 1 },
      disputeCases: {
        where: { channel: "DISPUTEFOX" },
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: { items: true, checklist: true },
      },
    },
  });

  return clients.map((client) => ({
    ...client,
    disputeFoxId: client.identifiers[0]?.externalId || null,
    latestRound: client.disputeRounds[0] || null,
    case: client.disputeCases[0] || null,
  }));
}
