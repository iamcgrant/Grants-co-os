import { prisma } from "@/lib/db/prisma";
import type { ConversationKind, MessageChannel } from "@/generated/prisma/client";
import { sendGhlOutboundMessage } from "@/lib/integrations/ghl/outbound";

/** Communication service abstraction — OS owns the conversation; providers deliver. */
export async function ensureTeamConversation(userIds: string[]) {
  const existing = await prisma.conversation.findFirst({
    where: {
      kind: "TEAM",
      clientId: null,
      AND: userIds.map((userId) => ({
        participants: { some: { userId } },
      })),
    },
    include: { participants: true },
  });
  if (existing && existing.participants.length === userIds.length) return existing;

  return prisma.conversation.create({
    data: {
      kind: "TEAM",
      subject: "Team",
      participants: {
        create: userIds.map((userId) => ({ userId })),
      },
    },
  });
}

export async function ensureClientConversation(clientId: string, kind: ConversationKind = "CLIENT") {
  const existing = await prisma.conversation.findFirst({
    where: { clientId, kind },
  });
  if (existing) return existing;
  return prisma.conversation.create({
    data: {
      clientId,
      kind,
      subject: kind === "CLIENT_INTERNAL" ? "Internal client thread" : "Client conversation",
    },
  });
}

/**
 * Record a historical inbound message already delivered by an external provider.
 * Never sends SMS, email, or iMessage. Dedupes on provider + externalId.
 */
export async function recordImportedMessage(input: {
  conversationId: string;
  body: string;
  channel?: MessageChannel;
  isInternal: boolean;
  provider: string;
  externalId: string;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
}): Promise<{ message: { id: string }; created: boolean }> {
  const provider = input.provider.trim();
  const externalId = input.externalId.trim();
  if (!provider || !externalId) {
    throw new Error("Imported messages require provider and externalId");
  }

  const existing = await prisma.message.findUnique({
    where: { provider_externalId: { provider, externalId } },
  });
  if (existing) {
    return { message: { id: existing.id }, created: false };
  }

  const message = await prisma.message.create({
    data: {
      conversationId: input.conversationId,
      body: input.body,
      channel: input.channel || (input.isInternal ? "INTERNAL" : "SMS"),
      isInternal: input.isInternal,
      deliveryStatus: "RECORDED",
      provider,
      externalId,
      createdAt: input.createdAt,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });

  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { lastMessageAt: input.createdAt || new Date() },
  });

  return { message: { id: message.id }, created: true };
}

export async function postMessage(input: {
  conversationId: string;
  senderId?: string;
  body: string;
  channel?: MessageChannel;
  isInternal: boolean;
  mentionUserIds?: string[];
  subject?: string;
  /** When the caller already delivered via GHL, only persist the OS row. */
  skipProviderSend?: boolean;
  provider?: string | null;
  externalId?: string | null;
  deliveryStatus?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!input.isInternal && input.channel === "INTERNAL") {
    throw new Error("Client-bound messages cannot use INTERNAL channel");
  }
  if (input.isInternal === false && !["SMS", "EMAIL", "CALL", "SYSTEM"].includes(input.channel || "SMS")) {
    // allow default SMS for outbound client
  }

  const channel = input.channel || (input.isInternal ? "INTERNAL" : "SMS");
  let deliveryStatus = input.deliveryStatus || (input.isInternal ? "RECORDED" : "PENDING");
  let provider: string | null = input.provider ?? null;
  let externalId: string | null = input.externalId ?? null;
  let metadata: Record<string, unknown> | undefined = input.metadata;

  if (
    !input.skipProviderSend &&
    !input.isInternal &&
    (channel === "SMS" || channel === "EMAIL")
  ) {
    const conv = await prisma.conversation.findUnique({
      where: { id: input.conversationId },
      include: {
        client: {
          include: {
            identifiers: { where: { provider: "GHL" }, take: 1 },
          },
        },
      },
    });
    const ghlContactId = conv?.client?.identifiers[0]?.externalId;
    if (!ghlContactId) {
      deliveryStatus = "FAILED";
      metadata = {
        actionRequired:
          "No GHL contact id on master client — link GHL before outbound send",
      };
    } else {
      const sent = await sendGhlOutboundMessage({
        channel: channel === "EMAIL" ? "Email" : "SMS",
        ghlContactId,
        body: input.body,
        subject: input.subject,
      });
      if (sent.ok) {
        deliveryStatus = "SENT";
        provider = "GHL";
        externalId = sent.providerMessageId;
        metadata = { conversationId: sent.conversationId, subject: input.subject };
      } else {
        deliveryStatus = "FAILED";
        metadata = {
          actionRequired: sent.reason,
          requiredScope: sent.requiredScope,
          httpStatus: sent.httpStatus,
          providerMessage: sent.providerMessage,
        };
      }
    }
  }

  const message = await prisma.message.create({
    data: {
      conversationId: input.conversationId,
      senderId: input.senderId,
      body: input.body,
      channel,
      isInternal: input.isInternal,
      deliveryStatus,
      provider,
      externalId,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
      mentions: input.mentionUserIds?.length
        ? { create: input.mentionUserIds.map((userId) => ({ userId })) }
        : undefined,
    },
  });

  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { lastMessageAt: new Date() },
  });

  return { message, deliveryStatus, metadata };
}

export async function listInbox(userId: string, tab: "all" | "client" | "team" = "all") {
  const kinds =
    tab === "client"
      ? (["CLIENT"] as ConversationKind[])
      : tab === "team"
        ? (["TEAM", "CLIENT_INTERNAL"] as ConversationKind[])
        : (["CLIENT", "TEAM", "CLIENT_INTERNAL"] as ConversationKind[]);

  return prisma.conversation.findMany({
    where: {
      kind: { in: kinds },
      OR: [
        { participants: { some: { userId } } },
        { kind: "CLIENT" },
        { kind: "CLIENT_INTERNAL" },
      ],
    },
    include: {
      client: { select: { grantsClientId: true, firstName: true, lastName: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { firstName: true, lastName: true } } },
      },
      participants: {
        include: { user: { select: { firstName: true, lastName: true, role: true } } },
      },
    },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take: 40,
  });
}
