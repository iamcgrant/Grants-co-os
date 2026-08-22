/**
 * In-OS SmartCredit desk. SmartCredit is the background platform — Grants OS is the product.
 * No public score/list API. No scrape. Official portal is last-step only.
 */

import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { addTimelineEvent } from "@/lib/clients/timeline";
import { CLIENT_IDENTIFIER_PROVIDER } from "@/lib/clients/identifiers";
import { attachExternalIdentifier } from "@/lib/clients/service";
import { getSmartCreditSponsorConfig } from "@/lib/credit/smartcredit-sponsor";
import {
  isSmartCreditSessionKind,
  sessionKindLabel,
  smartCreditLastStepUrl,
  type SmartCreditSessionKind,
} from "@/lib/credit/smartcredit-catalog";

export {
  isSmartCreditSessionKind,
  sessionKindLabel,
  smartCreditLastStepUrl,
  SMARTCREDIT_SESSION_KINDS,
  type SmartCreditSessionKind,
} from "@/lib/credit/smartcredit-catalog";

export const SMARTCREDIT_PROVIDER = CLIENT_IDENTIFIER_PROVIDER.SMARTCREDIT;
export const SMARTCREDIT_INTEGRATION = "smartcredit";

export class SmartCreditWorkspaceError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "SmartCreditWorkspaceError";
  }
}

async function findClient(clientId: string) {
  const client = await prisma.client.findFirst({
    where: { OR: [{ id: clientId }, { grantsClientId: clientId }] },
    select: { id: true, grantsClientId: true, firstName: true, lastName: true },
  });
  if (!client) throw new SmartCreditWorkspaceError("Client not found", 404);
  return client;
}

export async function attachSmartCreditClient(input: {
  clientId: string;
  externalId: string;
  actorId?: string;
}) {
  const externalId = input.externalId.trim();
  if (!externalId) throw new SmartCreditWorkspaceError("SmartCredit member id is required");

  const client = await findClient(input.clientId);
  const existing = await prisma.clientIdentifier.findUnique({
    where: { provider_externalId: { provider: SMARTCREDIT_PROVIDER, externalId } },
  });
  if (existing && existing.clientId !== client.id) {
    throw new SmartCreditWorkspaceError("That SmartCredit id is already attached to another Grants client");
  }

  const identifier = await attachExternalIdentifier({
    clientId: client.id,
    provider: SMARTCREDIT_PROVIDER,
    externalId,
    metadata: { source: "staff_recorded", recordedAt: new Date().toISOString() },
  });

  await prisma.creditConnection.upsert({
    where: { clientId_provider: { clientId: client.id, provider: SMARTCREDIT_PROVIDER } },
    create: {
      clientId: client.id,
      provider: SMARTCREDIT_PROVIDER,
      status: "ATTACHED",
      externalId,
    },
    update: {
      status: "ATTACHED",
      externalId,
    },
  });

  await addTimelineEvent({
    clientId: client.id,
    actorId: input.actorId,
    eventType: "SMARTCREDIT_ATTACHED",
    title: "SmartCredit attached",
    description: "Staff recorded SmartCredit member id on the Grants master",
    idempotencyKey: `sc_attach:${client.id}:${externalId}`,
    metadata: { externalId },
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "SMARTCREDIT_ATTACHED",
    entityType: "Client",
    entityId: client.id,
    metadata: { externalId, grantsClientId: client.grantsClientId },
  });

  return { client, identifier };
}

export async function recordSmartCreditSession(input: {
  clientId: string;
  kind: SmartCreditSessionKind;
  notes?: string;
  result?: string;
  actorId?: string;
}) {
  if (!isSmartCreditSessionKind(input.kind)) {
    throw new SmartCreditWorkspaceError("Unknown SmartCredit session kind");
  }

  const client = await findClient(input.clientId);
  const now = new Date();
  const notes = input.notes?.trim() || null;
  const result = input.result?.trim() || null;

  const connection = await prisma.creditConnection.upsert({
    where: { clientId_provider: { clientId: client.id, provider: SMARTCREDIT_PROVIDER } },
    create: {
      clientId: client.id,
      provider: SMARTCREDIT_PROVIDER,
      status: "SESSION_RECORDED",
      lastSyncedAt: now,
    },
    update: {
      status: "SESSION_RECORDED",
      lastSyncedAt: now,
    },
  });

  const integration = await prisma.integrationConnection.upsert({
    where: { provider: SMARTCREDIT_INTEGRATION },
    create: { provider: SMARTCREDIT_INTEGRATION, status: "WORKSPACE", lastSyncAt: now },
    update: { lastSyncAt: now },
  });

  await prisma.integrationSyncEvent.create({
    data: {
      connectionId: integration.id,
      direction: "outbound",
      entityType: "SMARTCREDIT_SESSION",
      externalId: connection.externalId,
      status: "RECORDED",
      payloadJson: JSON.stringify({
        kind: input.kind,
        grantsClientId: client.grantsClientId,
        notes,
        result,
      }),
    },
  });

  await addTimelineEvent({
    clientId: client.id,
    actorId: input.actorId,
    eventType: "SMARTCREDIT_SESSION_RECORDED",
    title: `SmartCredit ${sessionKindLabel(input.kind)}`,
    description: notes || result || "Session recorded in Grants OS",
    metadata: { kind: input.kind, result },
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "SMARTCREDIT_SESSION_RECORDED",
    entityType: "Client",
    entityId: client.id,
    metadata: { kind: input.kind, grantsClientId: client.grantsClientId },
  });

  return {
    client,
    kind: input.kind,
    lastStepUrl: smartCreditLastStepUrl(input.kind, client.grantsClientId),
    sponsor: getSmartCreditSponsorConfig(),
    recordedAt: now.toISOString(),
  };
}

export async function startSmartCreditEnrollment(input: { clientId: string; actorId?: string }) {
  const client = await findClient(input.clientId);
  const now = new Date();
  const enrollmentUrl = smartCreditLastStepUrl("ENROLL", client.grantsClientId);
  const sponsor = getSmartCreditSponsorConfig();

  await prisma.creditConnection.upsert({
    where: { clientId_provider: { clientId: client.id, provider: SMARTCREDIT_PROVIDER } },
    create: {
      clientId: client.id,
      provider: SMARTCREDIT_PROVIDER,
      status: "PENDING_ENROLLMENT",
      lastSyncedAt: now,
    },
    update: {
      status: "PENDING_ENROLLMENT",
      lastSyncedAt: now,
    },
  });

  const integration = await prisma.integrationConnection.upsert({
    where: { provider: SMARTCREDIT_INTEGRATION },
    create: { provider: SMARTCREDIT_INTEGRATION, status: "WORKSPACE", lastSyncAt: now },
    update: { lastSyncAt: now },
  });

  await prisma.integrationSyncEvent.create({
    data: {
      connectionId: integration.id,
      direction: "outbound",
      entityType: "SMARTCREDIT_ENROLLMENT",
      status: "RECORDED",
      payloadJson: JSON.stringify({ grantsClientId: client.grantsClientId }),
    },
  });

  await addTimelineEvent({
    clientId: client.id,
    actorId: input.actorId,
    eventType: "SMARTCREDIT_ENROLLMENT_STARTED",
    title: "SmartCredit Enrollment Started",
    description: sponsor.sponsorUrl || sponsor.sponsorCode
      ? "Sponsored signup last-step recorded"
      : "Enrollment recorded — set SMARTCREDIT_SPONSOR_URL to preserve affiliate payouts",
    idempotencyKey: `sc_enroll:${client.id}:${now.toISOString().slice(0, 10)}`,
  });

  return {
    client,
    enrollmentUrl,
    sponsorConfigured: Boolean(sponsor.sponsorUrl || sponsor.sponsorCode),
    recordedAt: now.toISOString(),
  };
}

export async function latestSmartCreditRecordedAt(): Promise<Date | null> {
  const [sync, connection, submittedCase] = await Promise.all([
    prisma.integrationSyncEvent.findFirst({
      where: {
        status: "RECORDED",
        entityType: { in: ["SMARTCREDIT_SESSION", "SMARTCREDIT_ENROLLMENT"] },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.creditConnection.findFirst({
      where: { provider: SMARTCREDIT_PROVIDER, lastSyncedAt: { not: null } },
      orderBy: { lastSyncedAt: "desc" },
      select: { lastSyncedAt: true },
    }),
    prisma.disputeCase.findFirst({
      where: {
        channel: "SMARTCREDIT",
        OR: [{ submittedAt: { not: null } }, { resultsAt: { not: null } }],
      },
      orderBy: { updatedAt: "desc" },
      select: { submittedAt: true, resultsAt: true },
    }),
  ]);

  const dates = [sync?.createdAt, connection?.lastSyncedAt, submittedCase?.submittedAt, submittedCase?.resultsAt];
  let latest: Date | null = null;
  for (const date of dates) {
    if (!date) continue;
    if (!latest || date.getTime() > latest.getTime()) latest = date;
  }
  return latest;
}

export async function listSmartCreditBoard() {
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { identifiers: { some: { provider: SMARTCREDIT_PROVIDER } } },
        { creditConnections: { some: { provider: SMARTCREDIT_PROVIDER } } },
        { disputeCases: { some: { channel: "SMARTCREDIT" } } },
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
      identifiers: {
        where: { provider: SMARTCREDIT_PROVIDER },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { externalId: true },
      },
      creditConnections: {
        where: { provider: SMARTCREDIT_PROVIDER },
        take: 1,
        select: { status: true, lastSyncedAt: true, externalId: true },
      },
      disputeCases: {
        where: { channel: "SMARTCREDIT" },
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: { items: true, checklist: true },
      },
    },
  });

  return clients.map((client) => ({
    ...client,
    smartCreditId: client.identifiers[0]?.externalId || client.creditConnections[0]?.externalId || null,
    connection: client.creditConnections[0] || null,
    case: client.disputeCases[0] || null,
  }));
}
