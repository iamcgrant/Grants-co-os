import { describe, expect, it } from "vitest";
import { jwtVerify } from "jose";
import {
  DESKTOP_ENTITLEMENT_AUD,
  DESKTOP_ENTITLEMENT_PURPOSE,
  issueOwnerEntitlement,
} from "@/lib/desktop/owner-entitlement";
import type { AuthUser } from "@/lib/auth/session";

function user(role: AuthUser["role"], extras: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "owner-1",
    email: "owner@example.com",
    firstName: "Charles",
    lastName: "Grant",
    role,
    isActive: true,
    mfaEnabled: false,
    ...extras,
  };
}

describe("desktop owner entitlement", () => {
  it("signs an owner-only token with no message content", async () => {
    process.env.AUTH_SECRET = "test-secret-for-vitest-only-32chars!!";
    const body = await issueOwnerEntitlement(user("OWNER"));
    expect(body.entitled).toBe(true);
    expect(body.role).toBe("OWNER");
    expect(body.purpose).toBe(DESKTOP_ENTITLEMENT_PURPOSE);
    expect(body.aud).toBe(DESKTOP_ENTITLEMENT_AUD);
    expect(body).not.toHaveProperty("text");
    expect(JSON.stringify(body)).not.toMatch(/attachment|chat\.db|preview/i);

    const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
    const { payload } = await jwtVerify(body.entitlement!, secret, {
      audience: DESKTOP_ENTITLEMENT_AUD,
    });
    expect(payload.purpose).toBe(DESKTOP_ENTITLEMENT_PURPOSE);
    expect(payload.role).toBe("OWNER");
    expect(payload).not.toHaveProperty("text");
  });

  it("refuses staff, clients, and inactive users", async () => {
    process.env.AUTH_SECRET = "test-secret-for-vitest-only-32chars!!";
    expect((await issueOwnerEntitlement(null)).entitled).toBe(false);
    expect((await issueOwnerEntitlement(user("ADMIN"))).reason).toBe("not-owner");
    expect((await issueOwnerEntitlement(user("OWNER", { isActive: false }))).entitled).toBe(false);
  });
});
