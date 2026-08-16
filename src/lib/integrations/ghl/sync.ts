/**
 * GHL contact → Grants Client Record sync (inbound, existing master records only).
 *
 * Rules:
 * - Grants & Co OS is master identity (ONE HUMAN = ONE MASTER CLIENT RECORD)
 * - Match order: GHL id → email → normalized phone
 * - Never create duplicate Grants clients — do not create new clients on this path
 * - Never send messages
 * - Never create/update/delete contacts in GHL
 * - Fail closed without GHL_API_KEY
 * - Tag every identifier with dataPlane (development | production)
 */

import { prisma } from "@/lib/db/prisma";
import { attachExternalIdentifier } from "@/lib/clients/service";
import { normalizeEmail, normalizePhone } from "@/lib/clients/identity";
import { addTimelineEvent } from "@/lib/clients/timeline";
import { writeAuditLog } from "@/lib/audit/log";
import { getGcEnvironment, type IdentifierMeta } from "@/lib/integrations/env";
import {
  getGhlContact,
  isGhlApiReady,
  listGhlContacts,
  searchGhlContacts,
  type GhlApiContact,
  GhlApiError,
} from "./http";
import {
  GHL_API_KEY_ENV,
  GHL_LOCATION_ID_ENV,
  GHL_PRODUCTION_LOCATION_ID,
} from "./location";

export type SyncAction =
  | "UPDATED"
  | "LINKED"
  | "SKIPPED_NO_MATCH"
  | "SKIPPED_AMBIGUOUS"
  | "UNCHANGED";

export type MatchBy = "ghl_id" | "email" | "phone";

export type SyncContactResult = {
  action: SyncAction;
  grantsClientId?: string;
  clientId?: string;
  ghlContactId: string;
  matchedBy?: MatchBy;
  dryRun?: boolean;
  message?: string;
};

export type SyncOptions = {
  dryRun?: boolean;
  actorId?: string;
};

function mapContactName(c: GhlApiContact) {
  const firstName = (c.firstName || "").trim() || "Unknown";
  const lastName = (c.lastName || "").trim() || "Contact";
  return { firstName, lastName };
}

function buildMeta(c: GhlApiContact): IdentifierMeta {
  return {
    source: "ghl_api",
    dataPlane: getGcEnvironment(),
    syncedAt: new Date().toISOString(),
    locationId: c.locationId || GHL_PRODUCTION_LOCATION_ID,
    tags: c.tags,
    assignedUserId: c.assignedTo || undefined,
  };
}

export async function markGhlInboundConnection(status = "CONNECTED") {
  await ensureIntegrationConnection(status);
}

async function ensureIntegrationConnection(status: string) {
  await prisma.integrationConnection.upsert({
    where: { provider: "gohighlevel" },
    create: {
      provider: "gohighlevel",
      status,
      lastSyncAt: new Date(),
      configJson: JSON.stringify({
        dataPlane: getGcEnvironment(),
        locationId: GHL_PRODUCTION_LOCATION_ID,
        inboundOnly: true,
        existingMasterRecordsOnly: true,
      }),
    },
    update: {
      status,
      lastSyncAt: new Date(),
      configJson: JSON.stringify({
        dataPlane: getGcEnvironment(),
        locationId: GHL_PRODUCTION_LOCATION_ID,
        inboundOnly: true,
        existingMasterRecordsOnly: true,
      }),
    },
  });
}

async function recordSyncEvent(input: {
  direction: string;
  entityType: string;
  externalId?: string;
  status: string;
  payload?: unknown;
  errorMessage?: string;
}) {
  const connection = await prisma.integrationConnection.findUnique({
    where: { provider: "gohighlevel" },
  });
  if (!connection) return;
  await prisma.integrationSyncEvent.create({
    data: {
      connectionId: connection.id,
      direction: input.direction,
      entityType: input.entityType,
      externalId: input.externalId,
      status: input.status,
      payloadJson: input.payload ? JSON.stringify(input.payload) : null,
      errorMessage: input.errorMessage,
    },
  });
}

export function failClosedWithoutGhlKey(dryRun = false) {
  return {
    ready: false as const,
    dryRun,
    failedClosed: true as const,
    results: [] as SyncContactResult[],
    fetched: 0,
    requiredSecrets: [GHL_API_KEY_ENV],
    optionalSecrets: [GHL_LOCATION_ID_ENV],
    defaultLocationId: GHL_PRODUCTION_LOCATION_ID,
    message: `Fail-closed: ${GHL_API_KEY_ENV} is not set. Add it to host/runtime secrets (never commit). ${GHL_LOCATION_ID_ENV} defaults to ${GHL_PRODUCTION_LOCATION_ID} when omitted.`,
  };
}

type MatchedClient = {
  id: string;
  grantsClientId: string;
  email: string;
  emailNormalized: string;
  phone: string | null;
  phoneNormalized: string | null;
  firstName: string;
  lastName: string;
};

/**
 * Match order is strict: GHL id → email → normalized phone.
 * Never creates a Grants Client.
 */
export async function matchExistingGrantsClient(contact: GhlApiContact): Promise<
  | { client: MatchedClient; matchedBy: MatchBy }
  | { client: null; matchedBy: null; skip: "NO_MATCH" | "AMBIGUOUS" | "INVALID" }
> {
  const ghlContactId = contact.id?.trim();
  if (!ghlContactId) {
    return { client: null, matchedBy: null, skip: "INVALID" };
  }

  const existingIdent = await prisma.clientIdentifier.findUnique({
    where: {
      provider_externalId: { provider: "GHL", externalId: ghlContactId },
    },
    include: { client: true },
  });
  if (existingIdent) {
    return { client: existingIdent.client, matchedBy: "ghl_id" };
  }

  const emailNormalized = contact.email?.trim() ? normalizeEmail(contact.email) : null;
  if (emailNormalized) {
    const byEmail = await prisma.client.findUnique({
      where: { emailNormalized },
    });
    if (byEmail) {
      return { client: byEmail, matchedBy: "email" };
    }
  }

  const phoneNormalized = normalizePhone(contact.phone);
  if (phoneNormalized) {
    const byPhone = await prisma.client.findMany({
      where: { phoneNormalized },
    });
    if (byPhone.length > 1) {
      return { client: null, matchedBy: null, skip: "AMBIGUOUS" };
    }
    if (byPhone.length === 1) {
      return { client: byPhone[0], matchedBy: "phone" };
    }
  }

  return { client: null, matchedBy: null, skip: "NO_MATCH" };
}

async function applyInboundUpdate(input: {
  client: MatchedClient;
  contact: GhlApiContact;
  matchedBy: MatchBy;
  actorId?: string;
  dryRun?: boolean;
}): Promise<SyncContactResult> {
  const { client, contact, matchedBy, actorId, dryRun } = input;
  const ghlContactId = contact.id;
  const action: SyncAction = matchedBy === "ghl_id" ? "UPDATED" : "LINKED";

  if (dryRun) {
    return {
      action,
      grantsClientId: client.grantsClientId,
      clientId: client.id,
      ghlContactId,
      matchedBy,
      dryRun: true,
      message: `Dry-run: would ${action.toLowerCase()} ${client.grantsClientId} via ${matchedBy}`,
    };
  }

  const email = contact.email?.trim();
  const emailNormalized = email ? normalizeEmail(email) : client.emailNormalized;
  const phoneNormalized = normalizePhone(contact.phone) || client.phoneNormalized;
  const { firstName, lastName } = mapContactName(contact);
  const meta = buildMeta(contact);

  if (emailNormalized && emailNormalized !== client.emailNormalized) {
    const taken = await prisma.client.findUnique({ where: { emailNormalized } });
    if (taken && taken.id !== client.id) {
      await recordSyncEvent({
        direction: "inbound",
        entityType: "contact",
        externalId: ghlContactId,
        status: "AMBIGUOUS",
        errorMessage: "Inbound email belongs to a different Grants client",
      });
      return {
        action: "SKIPPED_AMBIGUOUS",
        ghlContactId,
        matchedBy,
        message: "Inbound email belongs to a different Grants client — resolve manually",
      };
    }
  }

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: {
      email: email || client.email,
      emailNormalized,
      phone: contact.phone?.trim() || client.phone,
      phoneNormalized,
      firstName,
      lastName,
      lastInteractionAt: new Date(),
    },
  });

  await attachExternalIdentifier({
    clientId: updated.id,
    provider: "GHL",
    externalId: ghlContactId,
    metadata: meta,
  });

  await addTimelineEvent({
    clientId: updated.id,
    actorId,
    eventType: matchedBy === "ghl_id" ? "GHL_SYNC" : "GHL_LINKED",
    title: matchedBy === "ghl_id" ? "GHL contact synced" : "GHL contact linked",
    description:
      matchedBy === "ghl_id"
        ? `Updated from GHL · ${ghlContactId}`
        : `Linked to existing ${updated.grantsClientId} via ${matchedBy}`,
    idempotencyKey:
      matchedBy === "ghl_id"
        ? `ghl_sync:${ghlContactId}:${meta.syncedAt}`
        : `ghl_link:${ghlContactId}:${updated.id}`,
  });

  if (matchedBy !== "ghl_id") {
    await writeAuditLog({
      actorId,
      action: "GHL_CONTACT_LINKED",
      entityType: "Client",
      entityId: updated.id,
      metadata: { ghlContactId, grantsClientId: updated.grantsClientId, matchedBy },
    });
  }

  await recordSyncEvent({
    direction: "inbound",
    entityType: "contact",
    externalId: ghlContactId,
    status: action,
    payload: { grantsClientId: updated.grantsClientId, matchedBy },
  });

  return {
    action,
    grantsClientId: updated.grantsClientId,
    clientId: updated.id,
    ghlContactId,
    matchedBy,
  };
}

/**
 * Upsert one GHL contact onto an existing Grants master client record.
 * Does not create Grants clients. Does not write to GHL.
 */
export async function syncGhlContactToGrants(
  contact: GhlApiContact,
  actorId?: string,
  options?: SyncOptions,
): Promise<SyncContactResult> {
  const dryRun = Boolean(options?.dryRun);
  const actor = options?.actorId ?? actorId;
  const ghlContactId = contact.id?.trim() || "";

  const match = await matchExistingGrantsClient(contact);
  if (!match.client) {
    const action: SyncAction =
      match.skip === "AMBIGUOUS" ? "SKIPPED_AMBIGUOUS" : "SKIPPED_NO_MATCH";
    const message =
      match.skip === "INVALID"
        ? "Missing GHL contact id"
        : match.skip === "AMBIGUOUS"
          ? "Multiple Grants clients matched normalized phone — resolve manually before linking"
          : "No existing Grants master client matched GHL id, email, or normalized phone — not created";

    if (!dryRun && ghlContactId) {
      await recordSyncEvent({
        direction: "inbound",
        entityType: "contact",
        externalId: ghlContactId,
        status: action,
        errorMessage: message,
      });
    }

    return { action, ghlContactId, dryRun: dryRun || undefined, message };
  }

  return applyInboundUpdate({
    client: match.client,
    contact,
    matchedBy: match.matchedBy,
    actorId: actor,
    dryRun,
  });
}

export async function syncGhlContactById(
  ghlContactId: string,
  actorId?: string,
  options?: SyncOptions,
): Promise<SyncContactResult> {
  if (!isGhlApiReady()) {
    throw new GhlApiError(
      `GHL API not configured (need ${GHL_API_KEY_ENV}; ${GHL_LOCATION_ID_ENV} defaults to ${GHL_PRODUCTION_LOCATION_ID})`,
      503,
    );
  }
  const contact = await getGhlContact(ghlContactId);
  const result = await syncGhlContactToGrants(contact, actorId, options);
  if (!options?.dryRun) {
    await ensureIntegrationConnection("CONNECTED");
  }
  return result;
}

/**
 * Pull a page of GHL contacts and link onto existing Grants Client records only.
 * Without GHL_API_KEY this fails closed (no live fetch, no client writes).
 */
export async function pullGhlContacts(input: {
  query?: string;
  limit?: number;
  actorId?: string;
  dryRun?: boolean;
}): Promise<{
  ready: boolean;
  dryRun: boolean;
  failedClosed?: boolean;
  results: SyncContactResult[];
  fetched: number;
  message?: string;
  requiredSecrets?: string[];
  optionalSecrets?: string[];
  defaultLocationId?: string;
}> {
  const dryRun = Boolean(input.dryRun);

  if (!isGhlApiReady()) {
    if (!dryRun) {
      await ensureIntegrationConnection("AWAITING_CREDENTIALS");
    }
    return failClosedWithoutGhlKey(dryRun);
  }

  const limit = Math.min(Math.max(input.limit ?? 25, 1), 50);
  let contacts: GhlApiContact[] = [];

  if (input.query?.trim()) {
    const searched = await searchGhlContacts({ query: input.query, pageLimit: limit });
    contacts = searched.contacts;
  } else {
    const listed = await listGhlContacts({ limit });
    contacts = listed.contacts;
    if (contacts.length === 0) {
      const searched = await searchGhlContacts({ pageLimit: limit });
      contacts = searched.contacts;
    }
  }

  const results: SyncContactResult[] = [];
  for (const c of contacts) {
    results.push(await syncGhlContactToGrants(c, input.actorId, { dryRun }));
  }

  if (!dryRun) {
    await ensureIntegrationConnection("CONNECTED");
  }

  return {
    ready: true,
    dryRun,
    results,
    fetched: contacts.length,
    defaultLocationId: GHL_PRODUCTION_LOCATION_ID,
    message: dryRun
      ? "Dry-run: no Grants client writes. No GHL contact creates/updates/deletes."
      : "Inbound sync onto existing master client records only. No GHL writes.",
  };
}
