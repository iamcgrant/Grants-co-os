import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { addTimelineEvent } from "@/lib/clients/timeline";
import {
  getPortalEntry,
  isPortalProviderId,
  resolveLaunchMode,
  type PortalProviderId,
} from "@/lib/portals/catalog";

export const PORTAL_RESULT_STATUSES = [
  "OPENED",
  "IN_PROGRESS",
  "FILED",
  "COMPLETED",
  "NO_ACTION",
  "BLOCKED",
] as const;

export type PortalResultStatus = (typeof PORTAL_RESULT_STATUSES)[number];

export function isPortalResultStatus(value: string): value is PortalResultStatus {
  return (PORTAL_RESULT_STATUSES as readonly string[]).includes(value);
}

export async function openPortalSession(input: {
  provider: PortalProviderId;
  openedById: string;
  clientId?: string | null;
  notes?: string;
}) {
  if (!isPortalProviderId(input.provider)) {
    throw new Error("Unknown portal provider");
  }
  const entry = getPortalEntry(input.provider);
  const launchMode = resolveLaunchMode(entry);

  let clientId: string | null = null;
  if (input.clientId) {
    const client = await prisma.client.findFirst({
      where: { OR: [{ id: input.clientId }, { grantsClientId: input.clientId }] },
      select: { id: true, grantsClientId: true },
    });
    if (!client) throw new Error("Client not found");
    clientId = client.id;
  }

  const session = await prisma.portalWorkspaceSession.create({
    data: {
      provider: input.provider,
      clientId,
      openedById: input.openedById,
      portalUrl: entry.officialUrl,
      launchMode,
      resultStatus: "OPENED",
      notes: input.notes?.trim() || null,
    },
  });

  await writeAuditLog({
    actorId: input.openedById,
    action: "PORTAL_OPENED",
    entityType: "PortalWorkspaceSession",
    entityId: session.id,
    metadata: { provider: input.provider, launchMode, clientId },
  });

  if (clientId) {
    await addTimelineEvent({
      clientId,
      actorId: input.openedById,
      eventType: "PORTAL_OPENED",
      title: `${entry.label} portal opened`,
      description: `${launchMode === "IFRAME" ? "Embedded" : "New tab"} · ${entry.officialUrl}`,
    });
  }

  return { session, entry, launchMode };
}

export async function recordPortalResult(input: {
  sessionId: string;
  actorId: string;
  resultStatus: PortalResultStatus;
  externalRef?: string | null;
  notes?: string | null;
}) {
  if (!isPortalResultStatus(input.resultStatus)) {
    throw new Error("Invalid portal result status");
  }

  const existing = await prisma.portalWorkspaceSession.findUnique({
    where: { id: input.sessionId },
  });
  if (!existing) throw new Error("Portal session not found");

  const completed =
    input.resultStatus === "FILED" ||
    input.resultStatus === "COMPLETED" ||
    input.resultStatus === "NO_ACTION" ||
    input.resultStatus === "BLOCKED";

  const session = await prisma.portalWorkspaceSession.update({
    where: { id: input.sessionId },
    data: {
      resultStatus: input.resultStatus,
      externalRef: input.externalRef?.trim() || existing.externalRef,
      notes: input.notes?.trim() || existing.notes,
      completedAt: completed ? new Date() : existing.completedAt,
    },
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "PORTAL_RESULT",
    entityType: "PortalWorkspaceSession",
    entityId: session.id,
    metadata: {
      provider: session.provider,
      resultStatus: session.resultStatus,
      externalRef: session.externalRef,
    },
  });

  if (session.clientId) {
    const entry = isPortalProviderId(session.provider) ? getPortalEntry(session.provider) : null;
    await addTimelineEvent({
      clientId: session.clientId,
      actorId: input.actorId,
      eventType: "PORTAL_RESULT",
      title: `${entry?.label || session.provider} result · ${session.resultStatus.replaceAll("_", " ")}`,
      description: session.externalRef
        ? `Ref ${session.externalRef}${session.notes ? ` · ${session.notes}` : ""}`
        : session.notes || undefined,
    });
  }

  return session;
}

export async function listPortalSessions(input: {
  provider?: PortalProviderId;
  clientId?: string;
  take?: number;
}) {
  return prisma.portalWorkspaceSession.findMany({
    where: {
      provider: input.provider,
      clientId: input.clientId,
    },
    orderBy: { openedAt: "desc" },
    take: input.take ?? 40,
    include: {
      openedBy: { select: { firstName: true, lastName: true, role: true } },
      client: { select: { grantsClientId: true, firstName: true, lastName: true } },
    },
  });
}

export async function lastPortalSuccessAt(provider: PortalProviderId): Promise<Date | null> {
  const row = await prisma.portalWorkspaceSession.findFirst({
    where: {
      provider,
      resultStatus: { in: ["FILED", "COMPLETED"] },
    },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true, openedAt: true },
  });
  return row?.completedAt || row?.openedAt || null;
}
