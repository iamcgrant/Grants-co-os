/**
 * GHL contact → Grants Client Record sync.
 *
 * Rules:
 * - Grants & Co OS is master identity
 * - Never create duplicate clients (match GHL id → email → phone)
 * - Never send messages
 * - Never create/update contacts in GHL from this path
 * - Tag every identifier with dataPlane (development | production)
 */

import { prisma } from "@/lib/db/prisma";
import {
  attachExternalIdentifier,
  createClient,
  findPossibleDuplicates,
} from "@/lib/clients/service";
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

export type SyncAction =
  | "CREATED"
  | "UPDATED"
  | "LINKED"
  | "SKIPPED_NO_EMAIL"
  | "SKIPPED_AMBIGUOUS"
  | "UNCHANGED";

export type SyncContactResult = {
  action: SyncAction;
  grantsClientId?: string;
  clientId?: string;
  ghlContactId: string;
  message?: string;
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
    locationId: c.locationId,
    tags: c.tags,
    assignedUserId: c.assignedTo || undefined,
  };
}

async function ensureIntegrationConnection(status: string) {
  await prisma.integrationConnection.upsert({
    where: { provider: "gohighlevel" },
    create: {
      provider: "gohighlevel",
      status,
      lastSyncAt: new Date(),
      configJson: JSON.stringify({ dataPlane: getGcEnvironment() }),
    },
    update: {
      status,
      lastSyncAt: new Date(),
      configJson: JSON.stringify({ dataPlane: getGcEnvironment() }),
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

/**
 * Upsert one GHL contact into the Grants master client table.
 */
export async function syncGhlContactToGrants(
  contact: GhlApiContact,
  actorId?: string,
): Promise<SyncContactResult> {
  const ghlContactId = contact.id;
  if (!ghlContactId) {
    return { action: "SKIPPED_NO_EMAIL", ghlContactId: "", message: "Missing GHL contact id" };
  }

  const email = contact.email?.trim();
  if (!email) {
    await recordSyncEvent({
      direction: "inbound",
      entityType: "contact",
      externalId: ghlContactId,
      status: "SKIPPED",
      errorMessage: "Contact has no email — cannot create Grants Client safely",
    });
    return {
      action: "SKIPPED_NO_EMAIL",
      ghlContactId,
      message: "GHL contact has no email; skipped to avoid unsafe duplicate creation",
    };
  }

  const emailNormalized = normalizeEmail(email);
  const phoneNormalized = normalizePhone(contact.phone);
  const { firstName, lastName } = mapContactName(contact);
  const meta = buildMeta(contact);

  // 1) Exact GHL identifier match
  const existingIdent = await prisma.clientIdentifier.findUnique({
    where: {
      provider_externalId: { provider: "GHL", externalId: ghlContactId },
    },
    include: { client: true },
  });

  if (existingIdent) {
    const client = await prisma.client.update({
      where: { id: existingIdent.clientId },
      data: {
        email,
        emailNormalized,
        phone: contact.phone?.trim() || existingIdent.client.phone,
        phoneNormalized: phoneNormalized || existingIdent.client.phoneNormalized,
        firstName,
        lastName,
        lastInteractionAt: new Date(),
      },
    });

    await attachExternalIdentifier({
      clientId: client.id,
      provider: "GHL",
      externalId: ghlContactId,
      metadata: meta,
    });

    await addTimelineEvent({
      clientId: client.id,
      actorId,
      eventType: "GHL_SYNC",
      title: "GHL contact synced",
      description: `Updated from GHL · ${ghlContactId}`,
      idempotencyKey: `ghl_sync:${ghlContactId}:${meta.syncedAt}`,
    });

    await recordSyncEvent({
      direction: "inbound",
      entityType: "contact",
      externalId: ghlContactId,
      status: "UPDATED",
      payload: { grantsClientId: client.grantsClientId },
    });

    return {
      action: "UPDATED",
      grantsClientId: client.grantsClientId,
      clientId: client.id,
      ghlContactId,
    };
  }

  // 2) Match by email / phone — never create a second Grants Client
  const duplicates = await findPossibleDuplicates(emailNormalized, phoneNormalized);
  if (duplicates.length > 1) {
    const emailMatch = duplicates.find((d) => normalizeEmail(d.email) === emailNormalized);
    if (!emailMatch) {
      await recordSyncEvent({
        direction: "inbound",
        entityType: "contact",
        externalId: ghlContactId,
        status: "AMBIGUOUS",
        errorMessage: "Multiple Grants clients matched phone/email without clear email winner",
      });
      return {
        action: "SKIPPED_AMBIGUOUS",
        ghlContactId,
        message: "Multiple possible Grants clients — resolve manually before linking",
      };
    }
    // Prefer email match when ambiguous
    const client = await prisma.client.update({
      where: { id: emailMatch.id },
      data: {
        phone: contact.phone?.trim() || emailMatch.phone,
        phoneNormalized: phoneNormalized || undefined,
        firstName,
        lastName,
        duplicateFlag: true,
        lastInteractionAt: new Date(),
      },
    });
    await attachExternalIdentifier({
      clientId: client.id,
      provider: "GHL",
      externalId: ghlContactId,
      metadata: meta,
    });
    await addTimelineEvent({
      clientId: client.id,
      actorId,
      eventType: "GHL_LINKED",
      title: "GHL contact linked",
      description: `Linked to existing ${client.grantsClientId} (email match; phone collision flagged)`,
      idempotencyKey: `ghl_link:${ghlContactId}:${client.id}`,
    });
    await recordSyncEvent({
      direction: "inbound",
      entityType: "contact",
      externalId: ghlContactId,
      status: "LINKED",
      payload: { grantsClientId: client.grantsClientId, ambiguous: true },
    });
    return {
      action: "LINKED",
      grantsClientId: client.grantsClientId,
      clientId: client.id,
      ghlContactId,
      message: "Linked via email; duplicate phone candidates flagged",
    };
  }

  if (duplicates.length === 1) {
    const match = duplicates[0];
    const client = await prisma.client.update({
      where: { id: match.id },
      data: {
        email,
        emailNormalized,
        phone: contact.phone?.trim() || match.phone,
        phoneNormalized: phoneNormalized || undefined,
        firstName,
        lastName,
        lastInteractionAt: new Date(),
      },
    });

    await attachExternalIdentifier({
      clientId: client.id,
      provider: "GHL",
      externalId: ghlContactId,
      metadata: meta,
    });

    await addTimelineEvent({
      clientId: client.id,
      actorId,
      eventType: "GHL_LINKED",
      title: "GHL contact linked",
      description: `Linked to existing ${client.grantsClientId}`,
      idempotencyKey: `ghl_link:${ghlContactId}:${client.id}`,
    });

    await writeAuditLog({
      actorId,
      action: "GHL_CONTACT_LINKED",
      entityType: "Client",
      entityId: client.id,
      metadata: { ghlContactId, grantsClientId: client.grantsClientId },
    });

    await recordSyncEvent({
      direction: "inbound",
      entityType: "contact",
      externalId: ghlContactId,
      status: "LINKED",
      payload: { grantsClientId: client.grantsClientId },
    });

    return {
      action: "LINKED",
      grantsClientId: client.grantsClientId,
      clientId: client.id,
      ghlContactId,
    };
  }

  // 3) Create new Grants Client
  const created = await createClient({
    email,
    phone: contact.phone || undefined,
    firstName,
    lastName,
    actorId,
    notes: `Synced from GHL (${getGcEnvironment()})`,
  });

  if (created.status !== "CREATED") {
    // Race: duplicate appeared — link instead
    const again = await findPossibleDuplicates(emailNormalized, phoneNormalized);
    if (again[0]) {
      await attachExternalIdentifier({
        clientId: again[0].id,
        provider: "GHL",
        externalId: ghlContactId,
        metadata: meta,
      });
      return {
        action: "LINKED",
        grantsClientId: again[0].grantsClientId,
        clientId: again[0].id,
        ghlContactId,
      };
    }
    return {
      action: "SKIPPED_AMBIGUOUS",
      ghlContactId,
      message: "Could not create or link safely",
    };
  }

  await attachExternalIdentifier({
    clientId: created.client.id,
    provider: "GHL",
    externalId: ghlContactId,
    metadata: meta,
  });

  await writeAuditLog({
    actorId,
    action: "GHL_CONTACT_SYNCED",
    entityType: "Client",
    entityId: created.client.id,
    metadata: { ghlContactId, grantsClientId: created.client.grantsClientId },
  });

  await recordSyncEvent({
    direction: "inbound",
    entityType: "contact",
    externalId: ghlContactId,
    status: "CREATED",
    payload: { grantsClientId: created.client.grantsClientId },
  });

  return {
    action: "CREATED",
    grantsClientId: created.client.grantsClientId,
    clientId: created.client.id,
    ghlContactId,
  };
}

export async function syncGhlContactById(
  ghlContactId: string,
  actorId?: string,
): Promise<SyncContactResult> {
  if (!isGhlApiReady()) {
    throw new GhlApiError("GHL API not configured (need GHL_API_KEY + GHL_LOCATION_ID)", 503);
  }
  const contact = await getGhlContact(ghlContactId);
  const result = await syncGhlContactToGrants(contact, actorId);
  await ensureIntegrationConnection("CONNECTED");
  return result;
}

/**
 * Pull a page of GHL contacts and upsert into Grants Client records.
 */
export async function pullGhlContacts(input: {
  query?: string;
  limit?: number;
  actorId?: string;
}): Promise<{
  ready: boolean;
  results: SyncContactResult[];
  fetched: number;
  message?: string;
}> {
  if (!isGhlApiReady()) {
    await ensureIntegrationConnection("AWAITING_CREDENTIALS");
    return {
      ready: false,
      results: [],
      fetched: 0,
      message: "Awaiting Integration — set GHL_API_KEY and GHL_LOCATION_ID",
    };
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
    results.push(await syncGhlContactToGrants(c, input.actorId));
  }

  await ensureIntegrationConnection("CONNECTED");
  return { ready: true, results, fetched: contacts.length };
}
