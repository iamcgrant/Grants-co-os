import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import type { Role, User } from "@/generated/prisma/client";

const SESSION_COOKIE = "gc_session";
/** Brief OS session when staff uncheck Stay signed in. */
export const SESSION_DAYS_BRIEF = 14;
/** Stay-signed-in OS session so staff do not re-enter Grants & Co every morning. */
export const SESSION_DAYS_REMEMBER = 90;

function getSecret() {
  const secret = process.env.AUTH_SECRET || "grants-co-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(
  userId: string,
  meta?: { userAgent?: string; ip?: string; rememberMe?: boolean },
) {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const days = meta?.rememberMe === false ? SESSION_DAYS_BRIEF : SESSION_DAYS_REMEMBER;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: meta?.userAgent,
      ipAddress: meta?.ip,
    },
  });

  const jwt = await new SignJWT({ sid: tokenHash, uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${days}d`)
    .sign(getSecret());

  const cookieStore = await cookies();
  // Secure cookies whenever we are on HTTPS (production, Cloudflare tunnel, Vercel).
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.GC_FORCE_SECURE_COOKIES === "1" ||
    process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") === true;

  cookieStore.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  return { token: jwt, expiresAt };
}

export async function destroySession() {
  const cookieStore = await cookies();
  const jwt = cookieStore.get(SESSION_COOKIE)?.value;
  if (jwt) {
    try {
      const { payload } = await jwtVerify(jwt, getSecret());
      const tokenHash = payload.sid as string;
      await prisma.session.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // ignore invalid token
    }
  }
  cookieStore.delete(SESSION_COOKIE);
}

export type AuthUser = Pick<
  User,
  "id" | "email" | "firstName" | "lastName" | "role" | "isActive" | "mfaEnabled"
>;

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const jwt = cookieStore.get(SESSION_COOKIE)?.value;
  if (!jwt) return null;

  try {
    const { payload } = await jwtVerify(jwt, getSecret());
    const tokenHash = payload.sid as string;
    const userId = payload.uid as string;

    const session = await prisma.session.findFirst({
      where: {
        tokenHash,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            mfaEnabled: true,
          },
        },
      },
    });

    if (!session || !session.user.isActive) return null;
    return session.user;
  } catch {
    return null;
  }
}

export async function requireUser(roles?: Role[]): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  if (roles && !roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}

export { SESSION_COOKIE };
