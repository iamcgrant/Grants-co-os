import { randomBytes } from "node:crypto";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/session";
import {
  buildSetPasswordUrl,
  createPasswordSetupToken,
} from "@/lib/auth/password-setup";
import { writeAuditLog } from "@/lib/audit/log";

export const INVITABLE_ROLES = [
  Role.ADMIN,
  Role.MANAGER,
  Role.CUSTOMER_SERVICE,
  Role.FILE_PREPARER,
  Role.MARKETING,
] as const;

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

function isInvitableRole(value: string): value is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(value);
}

export async function inviteStaff(input: {
  actorId: string;
  actorRole: Role;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  baseUrl: string;
}) {
  if (input.actorRole !== Role.OWNER && input.actorRole !== Role.ADMIN) {
    throw new Error("Forbidden: only OWNER/ADMIN can invite staff");
  }
  if (!isInvitableRole(input.role)) {
    throw new Error("Role is not invitable");
  }
  if (input.role === Role.ADMIN && input.actorRole !== Role.OWNER) {
    throw new Error("Only OWNER can invite ADMIN");
  }

  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Valid email required");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("A user with that email already exists");

  const unusableHash = await hashPassword(randomBytes(32).toString("hex"));
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: unusableHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      role: input.role,
      isActive: true,
      mustChangePassword: true,
      staffProfile: {
        create: { title: input.role.replaceAll("_", " ") },
      },
    },
  });

  const setup = await createPasswordSetupToken({ userId: user.id, email: user.email });
  const setupUrl = buildSetPasswordUrl(input.baseUrl, setup.token);

  await writeAuditLog({
    actorId: input.actorId,
    action: "STAFF_INVITED",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
  });

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    setupUrl,
    expiresAt: setup.expiresAt.toISOString(),
  };
}
