import { SignJWT } from "jose";
import type { AuthUser } from "@/lib/auth/session";

export const DESKTOP_ENTITLEMENT_PURPOSE = "desktop-messages-owner";
export const DESKTOP_ENTITLEMENT_AUD = "com.grantandconsultants.os";
export const DESKTOP_ENTITLEMENT_MINUTES = 15;

function getSecret() {
  const secret = process.env.AUTH_SECRET || "grants-co-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export type OwnerEntitlementResponse = {
  entitled: boolean;
  role?: "OWNER";
  purpose?: typeof DESKTOP_ENTITLEMENT_PURPOSE;
  aud?: typeof DESKTOP_ENTITLEMENT_AUD;
  exp?: string;
  entitlement?: string;
  reason?: string;
};

/**
 * Server-signed owner unlock for the macOS Messages desk.
 * Never includes message contents, contacts, attachments, or metadata.
 */
export async function issueOwnerEntitlement(user: AuthUser | null): Promise<OwnerEntitlementResponse> {
  if (!user || !user.isActive) {
    return { entitled: false, reason: "unauthenticated" };
  }
  if (user.role !== "OWNER") {
    return { entitled: false, reason: "not-owner" };
  }

  const expiresAt = new Date(Date.now() + DESKTOP_ENTITLEMENT_MINUTES * 60 * 1000);
  const entitlement = await new SignJWT({
    purpose: DESKTOP_ENTITLEMENT_PURPOSE,
    role: "OWNER",
    uid: user.id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(DESKTOP_ENTITLEMENT_AUD)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecret());

  return {
    entitled: true,
    role: "OWNER",
    purpose: DESKTOP_ENTITLEMENT_PURPOSE,
    aud: DESKTOP_ENTITLEMENT_AUD,
    exp: expiresAt.toISOString(),
    entitlement,
  };
}
