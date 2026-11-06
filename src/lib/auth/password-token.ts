import { SignJWT, jwtVerify } from "jose";

export const SETUP_PURPOSE = "owner_password_setup" as const;
export const RESET_PURPOSE = "password_reset" as const;

const TOKEN_HOURS = 24;

export type PasswordTokenPurpose = typeof SETUP_PURPOSE | typeof RESET_PURPOSE;

export type PasswordTokenClaims = {
  purpose: PasswordTokenPurpose;
  uid: string;
  email: string;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET || "grants-co-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

function isPurpose(value: unknown): value is PasswordTokenPurpose {
  return value === SETUP_PURPOSE || value === RESET_PURPOSE;
}

/** A reset link can replace a password the person still knows. First-time setup cannot. */
export function passwordChangeAllowed(
  purpose: PasswordTokenPurpose,
  mustChangePassword: boolean,
): boolean {
  switch (purpose) {
    case RESET_PURPOSE:
      return true;
    case SETUP_PURPOSE:
      return mustChangePassword;
    default: {
      const unexpected: never = purpose;
      return unexpected;
    }
  }
}

export async function createPasswordToken(input: {
  userId: string;
  email: string;
  purpose: PasswordTokenPurpose;
}): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + TOKEN_HOURS * 60 * 60 * 1000);
  const token = await new SignJWT({
    purpose: input.purpose,
    uid: input.userId,
    email: input.email.toLowerCase(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecret());

  return { token, expiresAt };
}

export async function verifyPasswordToken(token: string): Promise<PasswordTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!isPurpose(payload.purpose)) return null;
    if (typeof payload.uid !== "string" || typeof payload.email !== "string") return null;
    return {
      purpose: payload.purpose,
      uid: payload.uid,
      email: payload.email.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function buildSetPasswordUrl(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/set-password?token=${encodeURIComponent(token)}`;
}
