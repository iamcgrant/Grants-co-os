/**
 * GHL conversations → Grants OS inbox (inbound read only).
 *
 * Rules:
 * - READ conversations/messages only. Never send SMS, email, or iMessage.
 * - Only existing master clients that already have a GHL identifier (linked).
 * - Never create GHL contacts. Never create Grants clients.
 * - Deduplicate on GHL message id (Message.provider + Message.externalId).
 * - Preserve opt-out / DND flags when present on the payload.
 * - Fail closed without GHL_API_KEY.
 * - If the PIT cannot list conversations/messages, fail closed and name the
 *   extra scope (`conversations.readonly`, plus `conversations/message.readonly`
 *   for message bodies). Do not widen scopes from this module.
 */

import { prisma } from "@/lib/db/prisma";
import { ensureClientConversation, recordImportedMessage } from "@/lib/communications/service";
import { addTimelineEvent } from "@/lib/clients/timeline";
import { writeAuditLog } from "@/lib/audit/log";
import { getGcEnvironment, parseIdentifierMeta, type IdentifierMeta } from "@/lib/integrations/env";
import type { MessageChannel } from "@/generated/prisma/client";
import {
  GhlApiError,
  isGhlApiReady,
  isGhlAuthScopeError,
  listGhlConversationMessages,
  searchGhlConversations,
  type GhlApiConversation,
  type GhlApiMessage,
} from "./http";
import {
  GHL_API_KEY_ENV,
  GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE,
  GHL_CONVERSATIONS_READONLY_SCOPE,
  GHL_LOCATION_ID_ENV,
} from "./location";

export type ConversationPullAction =
  | "IMPORTED"
  | "UNCHANGED"
  | "SKIPPED_NO_LINK"
  | "SKIPPED_NO_MESSAGES";

export type ConversationPullClientResult = {
  action: ConversationPullAction;
  grantsClientId?: string;
  clientId?: string;
  ghlContactId: string;
  conversations?: number;
  imported?: number;
  duplicates?: number;
  dryRun?: boolean;
  message?: string;
  commsFlags?: Record<string, unknown>;
};

export type ConversationPullOptions = {
  dryRun?: boolean;
  actorId?: string;
};

const COMMS_FLAG_KEYS = [
  "dnd",
  "dndSettings",
  "optedOut",
  "optOut",
  "unsubscribe",
  "doNotDisturb",
  "doNotContact",
  "dnc",
] as const;

export function extractCommsFlags(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as Record<string, unknown>;
  const flags: Record<string, unknown> = {};
  for (const key of COMMS_FLAG_KEYS) {
    if (record[key] !== undefined && record[key] !== null) {
      flags[key] = record[key];
    }
  }
  if (record.contact && typeof record.contact === "object") {
    Object.assign(flags, extractCommsFlags(record.contact));
  }
  return flags;
}

export function mapGhlMessageChannel(message: GhlApiMessage): MessageChannel {
  const raw = String(message.messageType || message.type || "").toUpperCase();
  if (raw.includes("EMAIL")) return "EMAIL";
  if (raw.includes("VOICEMAIL")) return "VOICEMAIL";
  if (raw.includes("CALL")) return "CALL";
  if (raw.includes("NOTE") || raw.includes("INTERNAL")) return "NOTE";
  if (raw.includes("SMS") || raw.includes("IMESSAGE") || raw.includes("WHATSAPP")) return "SMS";
  return "SYSTEM";
}

export function mapGhlMessageInternal(message: GhlApiMessage): boolean {
  const raw = String(message.messageType || message.type || "").toUpperCase();
  const direction = String(message.direction || "").toLowerCase();
  return direction === "internal" || raw.includes("INTERNAL") || raw.includes("NOTE");
}

function messageBody(message: GhlApiMessage): string {
  const body = typeof message.body === "string" ? message.body.trim() : "";
  if (body) return body;
  const html = typeof message.html === "string" ? message.html.trim() : "";
  if (html) return html;
  return "[empty message]";
}

function messageCreatedAt(message: GhlApiMessage): Date | undefined {
  const raw = message.dateAdded || message.dateUpdated;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function failClosedWithoutGhlKeyForConversations(dryRun = false) {
  return {
    ready: false as const,
    dryRun,
    failedClosed: true as const,
    missingScope: false as const,
    results: [] as ConversationPullClientResult[],
    linkedMasters: 0,
    fetchedConversations: 0,
    imported: 0,
    duplicates: 0,
    requiredSecrets: [GHL_API_KEY_ENV],
    optionalSecrets: [GHL_LOCATION_ID_ENV],
    requiredScope: GHL_CONVERSATIONS_READONLY_SCOPE,
    additionalScopesNeeded: [GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE],
    message: `Fail-closed: ${GHL_API_KEY_ENV} is not set. Add it to host/runtime secrets (never commit).`,
  };
}

export function failClosedMissingConversationScope(input: {
  dryRun?: boolean;
  requiredScope?: string;
  linkedMasters?: number;
}) {
  const requiredScope = input.requiredScope || GHL_CONVERSATIONS_READONLY_SCOPE;
  const additional = new Set([GHL_CONVERSATIONS_READONLY_SCOPE, GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE]);
  additional.delete(requiredScope);
  return {
    ready: false as const,
    dryRun: Boolean(input.dryRun),
    failedClosed: true as const,
    missingScope: true as const,
    results: [] as ConversationPullClientResult[],
    linkedMasters: input.linkedMasters ?? 0,
    fetchedConversations: 0,
    imported: 0,
    duplicates: 0,
    requiredSecrets: [GHL_API_KEY_ENV],
    optionalSecrets: [GHL_LOCATION_ID_ENV],
    requiredScope,
    additionalScopesNeeded: [...additional],
    message:
      `Fail-closed: GHL token cannot list conversations/messages. Required PIT scope: ${requiredScope}. ` +
      `Message bodies also need ${GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE}. ` +
      "Do not widen scopes from application code.",
  };
}

async function ensureIntegrationConnection(status: string, extra?: Record<string, unknown>) {
  await prisma.integrationConnection.upsert({
    where: { provider: "gohighlevel" },
    create: {
      provider: "gohighlevel",
      status,
      lastSyncAt: new Date(),
      configJson: JSON.stringify({
        dataPlane: getGcEnvironment(),
        inboundOnly: true,
        existingMasterRecordsOnly: true,
        conversationPull: true,
        sendMessages: false,
        ...extra,
      }),
    },
    update: {
      status,
      lastSyncAt: new Date(),
      configJson: JSON.stringify({
        dataPlane: getGcEnvironment(),
        inboundOnly: true,
        existingMasterRecordsOnly: true,
        conversationPull: true,
        sendMessages: false,
        ...extra,
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

async function listLinkedGhlMasters() {
  return prisma.clientIdentifier.findMany({
    where: { provider: "GHL" },
    include: {
      client: {
        select: {
          id: true,
          grantsClientId: true,
          firstName: true,
          lastName: true,
          lastInteractionAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function mergeIdentifierCommsFlags(
  identifierId: string,
  existingJson: string | null,
  flags: Record<string, unknown>,
) {
  if (!Object.keys(flags).length) return;
  const existing = parseIdentifierMeta(existingJson);
  const next: IdentifierMeta = {
    ...existing,
    commsFlags: { ...(existing.commsFlags || {}), ...flags },
  };
  if (typeof flags.dnd === "boolean") next.dnd = flags.dnd;
  if (typeof flags.optedOut === "boolean" || typeof flags.optOut === "boolean") {
    next.optedOut = Boolean(flags.optedOut ?? flags.optOut);
  }
  if (flags.dndSettings !== undefined) next.dndSettings = flags.dndSettings;
  await prisma.clientIdentifier.update({
    where: { id: identifierId },
    data: { metadataJson: JSON.stringify(next) },
  });
}

async function alreadyImported(externalId: string): Promise<boolean> {
  const existing = await prisma.message.findUnique({
    where: { provider_externalId: { provider: "GHL", externalId } },
  });
  return Boolean(existing);
}

async function importConversationMessages(input: {
  clientId: string;
  grantsClientId: string;
  ghlContactId: string;
  conversation: GhlApiConversation;
  dryRun: boolean;
  actorId?: string;
}): Promise<{ imported: number; duplicates: number; flags: Record<string, unknown> }> {
  const flags = extractCommsFlags(input.conversation);
  let imported = 0;
  let duplicates = 0;
  let lastMessageId: string | undefined;
  let pages = 0;

  const osConversation = input.dryRun
    ? null
    : await ensureClientConversation(input.clientId, "CLIENT");

  for (;;) {
    pages += 1;
    const page = await listGhlConversationMessages({
      conversationId: input.conversation.id,
      lastMessageId,
      limit: 50,
    });
    if (!page.messages.length) break;

    for (const ghlMessage of page.messages) {
      const messageId = String(ghlMessage.id || "").trim();
      if (!messageId) continue;
      const contactId = String(ghlMessage.contactId || input.conversation.contactId || "").trim();
      if (contactId && contactId !== input.ghlContactId) continue;

      Object.assign(flags, extractCommsFlags(ghlMessage));

      if (await alreadyImported(messageId)) {
        duplicates += 1;
        continue;
      }

      if (input.dryRun) {
        imported += 1;
        continue;
      }

      if (!osConversation) continue;
      const recorded = await recordImportedMessage({
        conversationId: osConversation.id,
        body: messageBody(ghlMessage),
        channel: mapGhlMessageChannel(ghlMessage),
        isInternal: mapGhlMessageInternal(ghlMessage),
        provider: "GHL",
        externalId: messageId,
        createdAt: messageCreatedAt(ghlMessage),
        metadata: {
          source: "ghl_api",
          dataPlane: getGcEnvironment(),
          ghlConversationId: input.conversation.id,
          ghlContactId: input.ghlContactId,
          ghlMessageType: ghlMessage.messageType || ghlMessage.type || null,
          ghlDirection: ghlMessage.direction || null,
          ghlStatus: ghlMessage.status || null,
          commsFlags: extractCommsFlags(ghlMessage),
        },
      });
      if (recorded.created) imported += 1;
      else duplicates += 1;
    }

    if (!page.nextPage) break;
    const nextId = page.lastMessageId || page.messages[page.messages.length - 1]?.id;
    if (!nextId || nextId === lastMessageId || pages > 40) break;
    lastMessageId = nextId;
  }

  return { imported, duplicates, flags };
}

/**
 * Pull GHL conversations/messages into the OS inbox for already-linked masters only.
 */
export async function pullGhlConversationsForLinkedMasters(input: ConversationPullOptions = {}): Promise<{
  ready: boolean;
  dryRun: boolean;
  failedClosed?: boolean;
  missingScope?: boolean;
  results: ConversationPullClientResult[];
  linkedMasters: number;
  fetchedConversations: number;
  imported: number;
  duplicates: number;
  message?: string;
  requiredSecrets?: string[];
  optionalSecrets?: string[];
  requiredScope?: string;
  additionalScopesNeeded?: string[];
}> {
  const dryRun = Boolean(input.dryRun);

  if (!isGhlApiReady()) {
    if (!dryRun) {
      await ensureIntegrationConnection("AWAITING_CREDENTIALS");
    }
    return failClosedWithoutGhlKeyForConversations(dryRun);
  }

  const linked = await listLinkedGhlMasters();
  const results: ConversationPullClientResult[] = [];
  let fetchedConversations = 0;
  let imported = 0;
  let duplicates = 0;

  try {
    for (const ident of linked) {
      const ghlContactId = ident.externalId;
      const conversations = await searchGhlConversations({ contactId: ghlContactId, limit: 50 });
      fetchedConversations += conversations.conversations.length;

      if (conversations.conversations.length === 0) {
        results.push({
          action: "SKIPPED_NO_MESSAGES",
          grantsClientId: ident.client.grantsClientId,
          clientId: ident.client.id,
          ghlContactId,
          conversations: 0,
          imported: 0,
          duplicates: 0,
          dryRun: dryRun || undefined,
          message: "No GHL conversations for this linked master",
        });
        continue;
      }

      let clientImported = 0;
      let clientDuplicates = 0;
      const flags: Record<string, unknown> = {};

      for (const conversation of conversations.conversations) {
        const contactId = String(conversation.contactId || "").trim();
        if (contactId && contactId !== ghlContactId) continue;
        const page = await importConversationMessages({
          clientId: ident.client.id,
          grantsClientId: ident.client.grantsClientId,
          ghlContactId,
          conversation,
          dryRun,
          actorId: input.actorId,
        });
        clientImported += page.imported;
        clientDuplicates += page.duplicates;
        Object.assign(flags, page.flags);
      }

      imported += clientImported;
      duplicates += clientDuplicates;

      if (!dryRun && Object.keys(flags).length) {
        await mergeIdentifierCommsFlags(ident.id, ident.metadataJson, flags);
      }

      if (!dryRun && clientImported > 0) {
        await prisma.client.update({
          where: { id: ident.client.id },
          data: { lastInteractionAt: new Date() },
        });
        await addTimelineEvent({
          clientId: ident.client.id,
          actorId: input.actorId,
          eventType: "GHL_INBOX_PULL",
          title: "GHL conversations pulled into inbox",
          description: `Imported ${clientImported} GHL message(s) · no outbound send`,
          idempotencyKey: `ghl_inbox_pull:${ident.client.id}:${new Date().toISOString().slice(0, 13)}`,
        });
        await recordSyncEvent({
          direction: "inbound",
          entityType: "conversation",
          externalId: ghlContactId,
          status: "IMPORTED",
          payload: { grantsClientId: ident.client.grantsClientId, imported: clientImported },
        });
      }

      results.push({
        action: clientImported > 0 ? "IMPORTED" : "UNCHANGED",
        grantsClientId: ident.client.grantsClientId,
        clientId: ident.client.id,
        ghlContactId,
        conversations: conversations.conversations.length,
        imported: clientImported,
        duplicates: clientDuplicates,
        dryRun: dryRun || undefined,
        commsFlags: Object.keys(flags).length ? flags : undefined,
      });
    }
  } catch (err) {
    if (err instanceof GhlApiError && isGhlAuthScopeError(err)) {
      if (!dryRun) {
        await ensureIntegrationConnection("AWAITING_SCOPE", {
          requiredScope: err.requiredScope || GHL_CONVERSATIONS_READONLY_SCOPE,
        });
      }
      return failClosedMissingConversationScope({
        dryRun,
        requiredScope: err.requiredScope || GHL_CONVERSATIONS_READONLY_SCOPE,
        linkedMasters: linked.length,
      });
    }
    throw err;
  }

  if (!dryRun) {
    await ensureIntegrationConnection("CONNECTED");
    await writeAuditLog({
      actorId: input.actorId,
      action: "GHL_CONVERSATIONS_PULLED",
      entityType: "Conversation",
      metadata: {
        linkedMasters: linked.length,
        fetchedConversations,
        imported,
        duplicates,
        inboundOnly: true,
      },
    });
  }

  return {
    ready: true,
    dryRun,
    results,
    linkedMasters: linked.length,
    fetchedConversations,
    imported,
    duplicates,
    requiredScope: GHL_CONVERSATIONS_READONLY_SCOPE,
    additionalScopesNeeded: [GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE],
    message: dryRun
      ? "Dry-run: no inbox writes. No GHL sends. Linked masters only."
      : "Inbound conversation pull onto linked master inboxes only. No GHL writes or sends.",
  };
}

export type GhlLocationInboxThread = {
  conversationId: string;
  contactId: string | null;
  lastMessageBody: string | null;
  lastMessageType: string | null;
  lastMessageDirection: string | null;
  lastMessageAt: string | null;
  channel: "SMS" | "EMAIL" | "CALL" | "OTHER";
  grantsClientId: string | null;
  clientName: string | null;
  clientId: string | null;
};

function locationThreadChannel(conversation: GhlApiConversation): GhlLocationInboxThread["channel"] {
  const raw = String(conversation.lastMessageType || "").toUpperCase();
  if (raw.includes("EMAIL")) return "EMAIL";
  if (raw.includes("CALL") || raw.includes("VOICE")) return "CALL";
  if (raw.includes("SMS") || raw.includes("IMESSAGE") || raw.includes("WHATSAPP")) return "SMS";
  return "OTHER";
}

/**
 * Location-wide GHL conversation list for the staff inbox.
 * Does not create Grants clients or GHL contacts.
 */
export async function listGhlLocationInbox(limit = 40): Promise<{
  ready: boolean;
  failedClosed?: boolean;
  missingScope?: boolean;
  threads: GhlLocationInboxThread[];
  requiredSecrets?: string[];
  requiredScope?: string;
  additionalScopesNeeded?: string[];
  message: string;
}> {
  if (!isGhlApiReady()) {
    return {
      ready: false,
      failedClosed: true,
      threads: [],
      requiredSecrets: [GHL_API_KEY_ENV],
      requiredScope: GHL_CONVERSATIONS_READONLY_SCOPE,
      additionalScopesNeeded: [GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE],
      message: `Fail-closed: ${GHL_API_KEY_ENV} is not set. Add it to host secrets to list GHL conversations in-OS.`,
    };
  }

  try {
    const found = await searchGhlConversations({ limit });
    const linked = await listLinkedGhlMasters();
    const byContact = new Map(linked.map((row) => [row.externalId, row.client]));
    const threads = found.conversations.map((conversation) => {
      const contactId = String(conversation.contactId || "").trim() || null;
      const client = contactId ? byContact.get(contactId) : undefined;
      return {
        conversationId: conversation.id,
        contactId,
        lastMessageBody: conversation.lastMessageBody || null,
        lastMessageType: conversation.lastMessageType || null,
        lastMessageDirection: conversation.lastMessageDirection || null,
        lastMessageAt: conversation.lastMessageDate || null,
        channel: locationThreadChannel(conversation),
        grantsClientId: client?.grantsClientId ?? null,
        clientName: client ? `${client.firstName} ${client.lastName}` : null,
        clientId: client?.id ?? null,
      };
    });
    return {
      ready: true,
      threads,
      requiredScope: GHL_CONVERSATIONS_READONLY_SCOPE,
      additionalScopesNeeded: [GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE],
      message: threads.length
        ? `Loaded ${threads.length} GHL conversation(s) from the location.`
        : "GHL API reached · no conversations at this location yet.",
    };
  } catch (err) {
    if (err instanceof GhlApiError && isGhlAuthScopeError(err)) {
      return {
        ready: false,
        failedClosed: true,
        missingScope: true,
        threads: [],
        requiredScope: err.requiredScope || GHL_CONVERSATIONS_READONLY_SCOPE,
        additionalScopesNeeded: [GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE],
        message:
          `Fail-closed: GHL token cannot list conversations. Required PIT scope: ${
            err.requiredScope || GHL_CONVERSATIONS_READONLY_SCOPE
          }.`,
      };
    }
    return {
      ready: false,
      failedClosed: true,
      threads: [],
      requiredScope: GHL_CONVERSATIONS_READONLY_SCOPE,
      message: err instanceof Error ? err.message : "GHL conversation list failed",
    };
  }
}

export async function summarizeGhlLocationInbox(): Promise<{
  ready: boolean;
  conversations: number;
  inboundEmail: number;
  missed: number;
  message: string;
}> {
  const inbox = await listGhlLocationInbox(100);
  if (!inbox.ready) {
    return {
      ready: false,
      conversations: 0,
      inboundEmail: 0,
      missed: 0,
      message: inbox.message,
    };
  }
  let inboundEmail = 0;
  let missed = 0;
  for (const thread of inbox.threads) {
    const direction = String(thread.lastMessageDirection || "").toLowerCase();
    const inbound = direction === "inbound" || direction === "in";
    if (thread.channel === "EMAIL" && inbound) inboundEmail += 1;
    if (inbound) missed += 1;
  }
  return {
    ready: true,
    conversations: inbox.threads.length,
    inboundEmail,
    missed,
    message: inbox.message,
  };
}
