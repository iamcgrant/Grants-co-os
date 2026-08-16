import { prisma } from "@/lib/db/prisma";
import type { ConversationKind, MessageChannel } from "@/generated/prisma/client";

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

export async function postMessage(input: {
  conversationId: string;
  senderId?: string;
  body: string;
  channel?: MessageChannel;
  isInternal: boolean;
  mentionUserIds?: string[];
}) {
  if (!input.isInternal && input.channel === "INTERNAL") {
    throw new Error("Client-bound messages cannot use INTERNAL channel");
  }
  if (input.isInternal === false && !["SMS", "EMAIL", "CALL", "SYSTEM"].includes(input.channel || "SMS")) {
    // allow default SMS for outbound client
  }

  const message = await prisma.message.create({
    data: {
      conversationId: input.conversationId,
      senderId: input.senderId,
      body: input.body,
      channel: input.channel || (input.isInternal ? "INTERNAL" : "SMS"),
      isInternal: input.isInternal,
      deliveryStatus: input.isInternal ? "RECORDED" : "SENT",
      mentions: input.mentionUserIds?.length
        ? { create: input.mentionUserIds.map((userId) => ({ userId })) }
        : undefined,
    },
  });

  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { lastMessageAt: new Date() },
  });

  return message;
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
