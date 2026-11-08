import { randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth/session";
import {
  SETUP_PURPOSE,
  createPasswordToken,
  verifyPasswordToken,
  type PasswordTokenClaims,
} from "@/lib/auth/password-token";
import { prisma } from "@/lib/db/prisma";

export {
  RESET_PURPOSE,
  SETUP_PURPOSE,
  buildSetPasswordUrl,
  createPasswordToken,
  passwordChangeAllowed,
  verifyPasswordToken,
} from "@/lib/auth/password-token";

export type PasswordSetupClaims = PasswordTokenClaims & {
  purpose: typeof SETUP_PURPOSE;
};

/** Create a single-use-style setup JWT (24h). Token itself is the capability. */
export async function createPasswordSetupToken(input: {
  userId: string;
  email: string;
}): Promise<{ token: string; expiresAt: Date }> {
  return createPasswordToken({ ...input, purpose: SETUP_PURPOSE });
}

export async function verifyPasswordSetupToken(
  token: string,
): Promise<PasswordSetupClaims | null> {
  const claims = await verifyPasswordToken(token);
  if (!claims || claims.purpose !== SETUP_PURPOSE) return null;
  return {
    purpose: SETUP_PURPOSE,
    uid: claims.uid,
    email: claims.email,
  };
}

/**
 * Ensure Owner exists with full OWNER role and force first-time password setup.
 * Replaces any prior password with an unusable random hash until setup completes.
 */
export async function ensureOwnerForFirstTimeSetup(input?: {
  email?: string;
  firstName?: string;
  lastName?: string;
}) {
  const email = (input?.email || "owner@grantsandco.com").toLowerCase();
  const firstName = input?.firstName || "Charles";
  const lastName = input?.lastName || "Grant";
  const unusableHash = await hashPassword(randomBytes(32).toString("hex"));

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "OWNER",
        isActive: true,
        firstName: existing.firstName || firstName,
        lastName: existing.lastName || lastName,
        passwordHash: unusableHash,
        mustChangePassword: true,
        mfaEnabled: false,
      },
      include: { staffProfile: true },
    });
    if (!user.staffProfile) {
      await prisma.staffProfile.create({
        data: { userId: user.id, title: "Owner / Super Admin" },
      });
    } else {
      await prisma.staffProfile.update({
        where: { userId: user.id },
        data: { title: "Owner / Super Admin" },
      });
    }
    // Revoke all sessions so only the new password path can enter.
    await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return user;
  }

  return prisma.user.create({
    data: {
      email,
      passwordHash: unusableHash,
      firstName,
      lastName,
      role: "OWNER",
      isActive: true,
      mustChangePassword: true,
      staffProfile: { create: { title: "Owner / Super Admin" } },
    },
  });
}

