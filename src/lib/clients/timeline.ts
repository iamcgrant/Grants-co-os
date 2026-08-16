import { prisma } from "@/lib/db/prisma";

export async function addTimelineEvent(input: {
  clientId: string;
  actorId?: string;
  eventType: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}) {
  if (input.idempotencyKey) {
    const existing = await prisma.clientTimelineEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
  }

  return prisma.clientTimelineEvent.create({
    data: {
      clientId: input.clientId,
      actorId: input.actorId,
      eventType: input.eventType,
      title: input.title,
      description: input.description,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      idempotencyKey: input.idempotencyKey,
    },
  });
}

export async function getClientTimeline(clientId: string, limit = 100) {
  return prisma.clientTimelineEvent.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { firstName: true, lastName: true, role: true } },
    },
  });
}
