import { randomBytes } from "node:crypto";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/session";
import { buildSetPasswordUrl, createPasswordSetupToken } from "@/lib/auth/password-setup";
import { writeAuditLog } from "@/lib/audit/log";
import { addTimelineEvent } from "@/lib/clients/timeline";

export async function inviteClientPortal(input: {
  actorId: string;
  clientId: string;
  baseUrl: string;
}) {
  const client = await prisma.client.findFirst({
    where: { OR: [{ id: input.clientId }, { grantsClientId: input.clientId }] },
  });
  if (!client) throw new Error("Client not found");

  const email = client.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Client email is required for a portal login");

  let user = client.userId
    ? await prisma.user.findUnique({ where: { id: client.userId } })
    : await prisma.user.findUnique({ where: { email } });

  if (user && user.role !== Role.CLIENT) {
    throw new Error("That email already belongs to a staff login");
  }

  if (!user) {
    const unusableHash = await hashPassword(randomBytes(32).toString("hex"));
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: unusableHash,
        firstName: client.firstName,
        lastName: client.lastName,
        role: Role.CLIENT,
        isActive: true,
        mustChangePassword: true,
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: true,
        mustChangePassword: true,
        firstName: user.firstName || client.firstName,
        lastName: user.lastName || client.lastName,
      },
    });
  }

  if (client.userId !== user.id) {
    await prisma.client.update({
      where: { id: client.id },
      data: { userId: user.id },
    });
  }

  const setup = await createPasswordSetupToken({ userId: user.id, email: user.email });
  const setupUrl = buildSetPasswordUrl(input.baseUrl, setup.token);

  await writeAuditLog({
    actorId: input.actorId,
    action: "CLIENT_PORTAL_INVITED",
    entityType: "Client",
    entityId: client.id,
    metadata: { email: user.email },
  });
  await addTimelineEvent({
    clientId: client.id,
    actorId: input.actorId,
    eventType: "PORTAL_INVITED",
    title: "Client portal invite",
    description: `Portal login created for ${user.email}`,
    idempotencyKey: `portal_invite:${client.id}:${user.id}:${setup.expiresAt.toISOString()}`,
  });

  return {
    clientId: client.id,
    grantsClientId: client.grantsClientId,
    email: user.email,
    setupUrl,
    expiresAt: setup.expiresAt.toISOString(),
  };
}
