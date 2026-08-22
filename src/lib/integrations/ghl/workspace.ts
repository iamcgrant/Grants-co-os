/**
 * In-OS GHL client desk — list threads + send SMS/email via LeadConnector.
 * Does not open GHL’s UI. Inbound reads stay on http.ts; sends stay on outbound.ts.
 */

import { prisma } from "@/lib/db/prisma";
import { ensureClientConversation, postMessage } from "@/lib/communications/service";
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
  mapGhlMessageChannel,
  mapGhlMessageInternal,
} from "./conversations";
import {
  GHL_API_KEY_ENV,
  GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE,
  GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE,
  GHL_CONVERSATIONS_READONLY_SCOPE,
  GHL_CONVERSATIONS_WRITE_SCOPE,
} from "./location";
import { sendGhlOutboundMessage, type OutboundChannel } from "./outbound";

export type GhlDeskThread = {
  conversationId: string;
  contactId: string;
  lastMessageBody: string | null;
  lastMessageType: string | null;
  lastMessageDirection: string | null;
  lastMessageAt: string | null;
  channel: "SMS" | "EMAIL" | "CALL" | "OTHER";
};

export type GhlDeskMessage = {
  id: string;
  conversationId: string;
  body: string;
  channel: "SMS" | "EMAIL" | "CALL" | "VOICEMAIL" | "NOTE" | "SYSTEM";
  direction: string | null;
  dateAdded: string | null;
  status: string | null;
};

export type GhlClientDesk = {
  ready: boolean;
  failedClosed?: boolean;
  missingScope?: boolean;
  clientId: string;
  grantsClientId?: string;
  ghlContactId: string | null;
  osConversationId: string | null;
  threads: GhlDeskThread[];
  messages: GhlDeskMessage[];
  requiredScope?: string;
  additionalScopesNeeded?: string[];
  requiredSecrets?: string[];
  message: string;
};

function threadChannel(conversation: GhlApiConversation): GhlDeskThread["channel"] {
  const raw = String(conversation.lastMessageType || "").toUpperCase();
  if (raw.includes("EMAIL")) return "EMAIL";
  if (raw.includes("CALL") || raw.includes("VOICE")) return "CALL";
  if (raw.includes("SMS") || raw.includes("IMESSAGE") || raw.includes("WHATSAPP")) return "SMS";
  return "OTHER";
}

function deskChannel(message: GhlApiMessage): GhlDeskMessage["channel"] {
  const mapped = mapGhlMessageChannel(message);
  switch (mapped) {
    case "EMAIL":
      return "EMAIL";
    case "CALL":
      return "CALL";
    case "VOICEMAIL":
      return "VOICEMAIL";
    case "NOTE":
      return "NOTE";
    case "SMS":
      return "SMS";
    default:
      return "SYSTEM";
  }
}

function messageBody(message: GhlApiMessage): string {
  const body = typeof message.body === "string" ? message.body.trim() : "";
  if (body) return body;
  const html = typeof message.html === "string" ? message.html.trim() : "";
  if (html) return html;
  return "[empty message]";
}

export async function loadGhlClientDesk(input: {
  clientId: string;
  conversationId?: string;
  limit?: number;
}): Promise<GhlClientDesk> {
  const client = await prisma.client.findFirst({
    where: { OR: [{ id: input.clientId }, { grantsClientId: input.clientId }] },
    include: { identifiers: { where: { provider: "GHL" }, take: 1 } },
  });
  if (!client) {
    return {
      ready: false,
      failedClosed: true,
      clientId: input.clientId,
      ghlContactId: null,
      osConversationId: null,
      threads: [],
      messages: [],
      message: "Client not found",
    };
  }

  const ghlContactId = client.identifiers[0]?.externalId?.trim() || null;
  const osConversation = await ensureClientConversation(client.id, "CLIENT");

  if (!isGhlApiReady()) {
    return {
      ready: false,
      failedClosed: true,
      clientId: client.id,
      grantsClientId: client.grantsClientId,
      ghlContactId,
      osConversationId: osConversation.id,
      threads: [],
      messages: [],
      requiredSecrets: [GHL_API_KEY_ENV],
      requiredScope: GHL_CONVERSATIONS_READONLY_SCOPE,
      additionalScopesNeeded: [GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE],
      message: `Fail-closed: ${GHL_API_KEY_ENV} is not set. Add a Private Integration with ${GHL_CONVERSATIONS_READONLY_SCOPE} and ${GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE}.`,
    };
  }

  if (!ghlContactId) {
    return {
      ready: false,
      failedClosed: true,
      clientId: client.id,
      grantsClientId: client.grantsClientId,
      ghlContactId: null,
      osConversationId: osConversation.id,
      threads: [],
      messages: [],
      message: "No GHL contact id on this master client — link GHL before opening client comms.",
    };
  }

  try {
    const found = await searchGhlConversations({ contactId: ghlContactId, limit: input.limit ?? 20 });
    const threads = found.conversations
      .filter((conversation) => {
        const contactId = String(conversation.contactId || "").trim();
        return !contactId || contactId === ghlContactId;
      })
      .map((conversation) => ({
        conversationId: conversation.id,
        contactId: String(conversation.contactId || ghlContactId),
        lastMessageBody: conversation.lastMessageBody || null,
        lastMessageType: conversation.lastMessageType || null,
        lastMessageDirection: conversation.lastMessageDirection || null,
        lastMessageAt: conversation.lastMessageDate || null,
        channel: threadChannel(conversation),
      }));

    const activeId = input.conversationId || threads[0]?.conversationId;
    const messages: GhlDeskMessage[] = [];
    if (activeId) {
      const page = await listGhlConversationMessages({ conversationId: activeId, limit: 80 });
      for (const ghlMessage of page.messages) {
        if (mapGhlMessageInternal(ghlMessage)) continue;
        const contactId = String(ghlMessage.contactId || "").trim();
        if (contactId && contactId !== ghlContactId) continue;
        messages.push({
          id: String(ghlMessage.id || ""),
          conversationId: activeId,
          body: messageBody(ghlMessage),
          channel: deskChannel(ghlMessage),
          direction: ghlMessage.direction || null,
          dateAdded: typeof ghlMessage.dateAdded === "string" ? ghlMessage.dateAdded : null,
          status: ghlMessage.status || null,
        });
      }
    }

    return {
      ready: true,
      clientId: client.id,
      grantsClientId: client.grantsClientId,
      ghlContactId,
      osConversationId: osConversation.id,
      threads,
      messages,
      requiredScope: GHL_CONVERSATIONS_READONLY_SCOPE,
      additionalScopesNeeded: [GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE],
      message: threads.length
        ? "GHL conversations loaded in-OS."
        : "No GHL conversations for this linked contact yet.",
    };
  } catch (err) {
    if (err instanceof GhlApiError && isGhlAuthScopeError(err)) {
      return {
        ready: false,
        failedClosed: true,
        missingScope: true,
        clientId: client.id,
        grantsClientId: client.grantsClientId,
        ghlContactId,
        osConversationId: osConversation.id,
        threads: [],
        messages: [],
        requiredScope: err.requiredScope || GHL_CONVERSATIONS_READONLY_SCOPE,
        additionalScopesNeeded: [GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE],
        message:
          `Fail-closed: GHL token cannot list conversations/messages. Required PIT scope: ${
            err.requiredScope || GHL_CONVERSATIONS_READONLY_SCOPE
          }.`,
      };
    }
    throw err;
  }
}

export async function sendGhlClientMessage(input: {
  clientId: string;
  senderId?: string;
  channel: OutboundChannel;
  body: string;
  subject?: string;
}): Promise<{
  ok: boolean;
  deliveryStatus: string;
  messageId?: string;
  actionRequired?: string;
  requiredScope?: string;
}> {
  const client = await prisma.client.findFirst({
    where: { OR: [{ id: input.clientId }, { grantsClientId: input.clientId }] },
    include: { identifiers: { where: { provider: "GHL" }, take: 1 } },
  });
  if (!client) {
    return { ok: false, deliveryStatus: "FAILED", actionRequired: "Client not found" };
  }
  const ghlContactId = client.identifiers[0]?.externalId?.trim();
  if (!ghlContactId) {
    return {
      ok: false,
      deliveryStatus: "FAILED",
      actionRequired: "No GHL contact id on master client — link GHL before outbound send",
      requiredScope: GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE,
    };
  }

  const conversation = await ensureClientConversation(client.id, "CLIENT");
  const sent = await sendGhlOutboundMessage({
    channel: input.channel,
    ghlContactId,
    body: input.body,
    subject: input.subject,
  });

  const recorded = await postMessage({
    conversationId: conversation.id,
    senderId: input.senderId,
    body: input.body,
    channel: input.channel === "Email" ? "EMAIL" : "SMS",
    isInternal: false,
    skipProviderSend: true,
    provider: sent.ok ? "GHL" : "GHL",
    externalId: sent.ok ? sent.providerMessageId : undefined,
    deliveryStatus: sent.ok ? "SENT" : "FAILED",
    metadata: sent.ok
      ? { conversationId: sent.conversationId, channel: input.channel }
      : {
          actionRequired: sent.reason,
          requiredScope: sent.requiredScope,
          additionalScopesNeeded: sent.additionalScopesNeeded ?? [GHL_CONVERSATIONS_WRITE_SCOPE],
          httpStatus: sent.httpStatus,
          providerMessage: sent.providerMessage,
        },
  });

  if (!sent.ok) {
    return {
      ok: false,
      deliveryStatus: recorded.deliveryStatus,
      messageId: recorded.message.id,
      actionRequired: sent.reason,
      requiredScope: sent.requiredScope,
    };
  }

  return {
    ok: true,
    deliveryStatus: "SENT",
    messageId: recorded.message.id,
  };
}
