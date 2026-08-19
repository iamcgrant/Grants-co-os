import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/session";
import { assertStrongPassword } from "@/lib/auth/password-policy";
import { writeAuditLog } from "@/lib/audit/log";

export const DEFAULT_OWNER_EMAIL = "owner@grantsandco.com";

export type OwnerBootstrapResult = {
  email: string;
  updated: boolean;
  created: boolean;
  reason: string;
};

/**
 * Set the Owner login password from OWNER_BOOTSTRAP_PASSWORD.
 * Idempotent: skips when the owner can already sign in unless OWNER_BOOTSTRAP_FORCE=1.
 * Never logs the password.
 */
export async function ensureOwnerPasswordFromEnv(): Promise<OwnerBootstrapResult> {
  const password = process.env.OWNER_BOOTSTRAP_PASSWORD?.trim() || "";
  if (!password) {
    return {
      email: DEFAULT_OWNER_EMAIL,
      updated: false,
      created: false,
      reason: "OWNER_BOOTSTRAP_PASSWORD not set",
    };
  }
  return applyOwnerBootstrapPassword({
    password,
    email: (process.env.OWNER_EMAIL || DEFAULT_OWNER_EMAIL).toLowerCase(),
    firstName: process.env.OWNER_FIRST_NAME || "Charles",
    lastName: process.env.OWNER_LAST_NAME || "Grant",
    force: process.env.OWNER_BOOTSTRAP_FORCE === "1",
  });
}

export async function applyOwnerBootstrapPassword(input: {
  password: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  force?: boolean;
}): Promise<OwnerBootstrapResult> {
  assertStrongPassword(input.password);
  const email = (input.email || DEFAULT_OWNER_EMAIL).toLowerCase();
  const firstName = input.firstName || "Charles";
  const lastName = input.lastName || "Grant";
  const passwordHash = await hashPassword(input.password);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !existing.mustChangePassword && !input.force) {
    return {
      email,
      updated: false,
      created: false,
      reason: "Owner already has an active password",
    };
  }

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        isActive: true,
        role: "OWNER",
        firstName: existing.firstName || firstName,
        lastName: existing.lastName || lastName,
      },
    });
    await prisma.session.updateMany({
      where: { userId: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await prisma.staffProfile.upsert({
      where: { userId: existing.id },
      create: { userId: existing.id, title: "Owner / Super Admin" },
      update: { title: "Owner / Super Admin" },
    });
    await writeAuditLog({
      actorId: existing.id,
      action: "OWNER_PASSWORD_BOOTSTRAP",
      entityType: "User",
      entityId: existing.id,
    });
    return { email, updated: true, created: false, reason: "Owner password applied" };
  }

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: "OWNER",
      isActive: true,
      mustChangePassword: false,
      staffProfile: { create: { title: "Owner / Super Admin" } },
    },
  });
  await writeAuditLog({
    actorId: created.id,
    action: "OWNER_PASSWORD_BOOTSTRAP",
    entityType: "User",
    entityId: created.id,
  });
  return { email, updated: true, created: true, reason: "Owner created with bootstrap password" };
}
