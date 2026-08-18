import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { hashPassword } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const SETUP_PURPOSE = "owner_password_setup";
const SETUP_HOURS = 24;

function getSecret() {
  const secret = process.env.AUTH_SECRET || "grants-co-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export type PasswordSetupClaims = {
  purpose: typeof SETUP_PURPOSE;
  uid: string;
  email: string;
};

/** Create a single-use-style setup JWT (24h). Token itself is the capability. */
export async function createPasswordSetupToken(input: {
  userId: string;
  email: string;
}): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + SETUP_HOURS * 60 * 60 * 1000);
  const token = await new SignJWT({
    purpose: SETUP_PURPOSE,
    uid: input.userId,
    email: input.email.toLowerCase(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecret());

  return { token, expiresAt };
}

export async function verifyPasswordSetupToken(
  token: string,
): Promise<PasswordSetupClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== SETUP_PURPOSE) return null;
    if (typeof payload.uid !== "string" || typeof payload.email !== "string") return null;
    return {
      purpose: SETUP_PURPOSE,
      uid: payload.uid,
      email: payload.email.toLowerCase(),
    };
  } catch {
    return null;
  }
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

export function buildSetPasswordUrl(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/set-password?token=${encodeURIComponent(token)}`;
}
