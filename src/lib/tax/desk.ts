/**
 * Shared in-OS tax desk. Official portals are last-step only. No scrape.
 */

import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { addTimelineEvent } from "@/lib/clients/timeline";
import { attachExternalIdentifier } from "@/lib/clients/service";
import {
  isDeskSessionKind,
  isDeskStatus,
  taxDeskCatalog,
  taxLastStepUrl,
  taxSessionKindLabel,
  type TaxDesk,
  type TaxDeskStatus,
  type TaxSessionKind,
} from "./catalog";

export class TaxDeskError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "TaxDeskError";
  }
}

export type TaxDeskMeta = {
  source: "staff_recorded";
  recordedAt?: string;
  status?: TaxDeskStatus;
  nextAction?: string | null;
  taxYear?: string | null;
  amountCents?: number | null;
  lastSessionAt?: string | null;
  lastKind?: TaxSessionKind | null;
  result?: string | null;
};

function parseMeta(raw: string | null | undefined): TaxDeskMeta {
  if (!raw) return { source: "staff_recorded" };
  try {
    const parsed = JSON.parse(raw) as Partial<TaxDeskMeta>;
    return {
      source: "staff_recorded",
      recordedAt: typeof parsed.recordedAt === "string" ? parsed.recordedAt : undefined,
      status: parsed.status,
      nextAction: parsed.nextAction ?? null,
      taxYear: parsed.taxYear ?? null,
      amountCents: typeof parsed.amountCents === "number" ? parsed.amountCents : null,
      lastSessionAt: parsed.lastSessionAt ?? null,
      lastKind: parsed.lastKind ?? null,
      result: parsed.result ?? null,
    };
  } catch {
    return { source: "staff_recorded" };
  }
}

async function findClient(clientId: string) {
  const client = await prisma.client.findFirst({
    where: { OR: [{ id: clientId }, { grantsClientId: clientId }] },
    select: { id: true, grantsClientId: true, firstName: true, lastName: true, stage: true, nextAction: true },
  });
  if (!client) throw new TaxDeskError("Client not found", 404);
  return client;
}

export async function attachTaxDeskClient(input: {
  desk: TaxDesk;
  clientId: string;
  externalId: string;
  taxYear?: string;
  actorId?: string;
}) {
  const catalog = taxDeskCatalog(input.desk);
  const externalId = input.externalId.trim();
  if (!externalId) throw new TaxDeskError(`${catalog.label} id is required`);

  const client = await findClient(input.clientId);
  const existing = await prisma.clientIdentifier.findUnique({
    where: { provider_externalId: { provider: catalog.provider, externalId } },
  });
  if (existing && existing.clientId !== client.id) {
    throw new TaxDeskError(`That ${catalog.label} id is already attached to another Grants client`);
  }

  const prior = existing ? parseMeta(existing.metadataJson) : { source: "staff_recorded" as const };
  const identifier = await attachExternalIdentifier({
    clientId: client.id,
    provider: catalog.provider,
    externalId,
    metadata: {
      ...prior,
      source: "staff_recorded",
      recordedAt: new Date().toISOString(),
      taxYear: input.taxYear?.trim() || prior.taxYear || null,
    },
  });

  const eventType = `${input.desk}_ATTACHED`;
  await addTimelineEvent({
    clientId: client.id,
    actorId: input.actorId,
    eventType,
    title: `${catalog.label} attached`,
    description: `Staff recorded ${catalog.label} id on the Grants master`,
    idempotencyKey: `${catalog.integration}_attach:${client.id}:${externalId}`,
    metadata: { externalId, taxYear: input.taxYear?.trim() || null },
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: eventType,
    entityType: "Client",
    entityId: client.id,
    metadata: { externalId, grantsClientId: client.grantsClientId, desk: input.desk },
  });

  return { client, identifier };
}

export async function recordTaxDeskSession(input: {
  desk: TaxDesk;
  clientId: string;
  kind: TaxSessionKind;
  notes?: string;
  result?: string;
  status?: string;
  nextAction?: string;
  taxYear?: string;
  amountCents?: number;
  actorId?: string;
}) {
  const catalog = taxDeskCatalog(input.desk);
  if (!isDeskSessionKind(input.desk, input.kind)) {
    throw new TaxDeskError(`Unknown ${catalog.label} session kind`);
  }
  if (input.status && !isDeskStatus(input.desk, input.status)) {
    throw new TaxDeskError(`Unknown ${catalog.label} status`);
  }

  const client = await findClient(input.clientId);
  const now = new Date();
  const notes = input.notes?.trim() || null;
  const result = input.result?.trim() || null;
  const nextAction = input.nextAction?.trim() || null;
  const taxYear = input.taxYear?.trim() || null;
  const status = input.status as TaxDeskStatus | undefined;

  const identifier = await prisma.clientIdentifier.findFirst({
    where: { clientId: client.id, provider: catalog.provider },
    orderBy: { updatedAt: "desc" },
  });
  if (identifier) {
    const prior = parseMeta(identifier.metadataJson);
    await prisma.clientIdentifier.update({
      where: { id: identifier.id },
      data: {
        metadataJson: JSON.stringify({
          ...prior,
          source: "staff_recorded",
          status: status || prior.status,
          nextAction: nextAction ?? prior.nextAction,
          taxYear: taxYear ?? prior.taxYear,
          amountCents: input.amountCents ?? prior.amountCents,
          lastSessionAt: now.toISOString(),
          lastKind: input.kind,
          result: result ?? prior.result,
        } satisfies TaxDeskMeta),
      },
    });
  }

  const integration = await prisma.integrationConnection.upsert({
    where: { provider: catalog.integration },
    create: { provider: catalog.integration, status: "WORKSPACE", lastSyncAt: now },
    update: { lastSyncAt: now },
  });

  await prisma.integrationSyncEvent.create({
    data: {
      connectionId: integration.id,
      direction: "outbound",
      entityType: `${input.desk}_SESSION`,
      externalId: identifier?.externalId ?? null,
      status: "RECORDED",
      payloadJson: JSON.stringify({
        kind: input.kind,
        grantsClientId: client.grantsClientId,
        notes,
        result,
        status: status || null,
        nextAction,
        taxYear,
        amountCents: input.amountCents ?? null,
      }),
    },
  });

  await addTimelineEvent({
    clientId: client.id,
    actorId: input.actorId,
    eventType: `${input.desk}_SESSION`,
    title: `${catalog.label} ${taxSessionKindLabel(input.kind)}`,
    description: notes || result || "Session recorded in Grants OS",
    metadata: {
      kind: input.kind,
      result,
      status: status || null,
      nextAction,
      taxYear,
      amountCents: input.amountCents ?? null,
    },
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: `${input.desk}_SESSION`,
    entityType: "Client",
    entityId: client.id,
    metadata: { kind: input.kind, grantsClientId: client.grantsClientId, desk: input.desk },
  });

  return {
    client,
    kind: input.kind,
    lastStepUrl: taxLastStepUrl(input.desk, input.kind),
    recordedAt: now.toISOString(),
  };
}

export async function latestTaxDeskRecordedAt(desk: TaxDesk): Promise<Date | null> {
  const catalog = taxDeskCatalog(desk);
  const [sync, timeline] = await Promise.all([
    prisma.integrationSyncEvent.findFirst({
      where: { status: "RECORDED", entityType: `${desk}_SESSION` },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.clientTimelineEvent.findFirst({
      where: { eventType: `${desk}_SESSION` },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  void catalog;
  const dates = [sync?.createdAt, timeline?.createdAt];
  let latest: Date | null = null;
  for (const date of dates) {
    if (!date) continue;
    if (!latest || date.getTime() > latest.getTime()) latest = date;
  }
  return latest;
}

export type TaxDeskBoardRow = {
  id: string;
  grantsClientId: string;
  firstName: string;
  lastName: string;
  stage: string;
  nextAction: string | null;
  deskId: string | null;
  status: TaxDeskStatus | null;
  deskNextAction: string | null;
  taxYear: string | null;
  amountCents: number | null;
  lastSessionAt: Date | null;
  result: string | null;
};

export async function listTaxDeskBoard(desk: TaxDesk): Promise<TaxDeskBoardRow[]> {
  const catalog = taxDeskCatalog(desk);
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { identifiers: { some: { provider: catalog.provider } } },
        { timelineEvents: { some: { eventType: { in: [`${desk}_SESSION`, `${desk}_ATTACHED`] } } } },
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
        where: { provider: catalog.provider },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { externalId: true, metadataJson: true, updatedAt: true },
      },
      timelineEvents: {
        where: { eventType: { in: [`${desk}_SESSION`, `${desk}_ATTACHED`] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, metadataJson: true },
      },
    },
  });

  return clients.map((client) => {
    const ident = client.identifiers[0] || null;
    const meta = parseMeta(ident?.metadataJson);
    const timelineMeta = parseMeta(client.timelineEvents[0]?.metadataJson);
    const lastSessionAt =
      meta.lastSessionAt
        ? new Date(meta.lastSessionAt)
        : client.timelineEvents[0]?.createdAt || null;
    return {
      id: client.id,
      grantsClientId: client.grantsClientId,
      firstName: client.firstName,
      lastName: client.lastName,
      stage: client.stage,
      nextAction: client.nextAction,
      deskId: ident?.externalId || null,
      status: meta.status || timelineMeta.status || null,
      deskNextAction: meta.nextAction || timelineMeta.nextAction || null,
      taxYear: meta.taxYear || timelineMeta.taxYear || null,
      amountCents: meta.amountCents ?? timelineMeta.amountCents ?? null,
      lastSessionAt,
      result: meta.result || timelineMeta.result || null,
    };
  });
}
