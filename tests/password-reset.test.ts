import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RESET_PURPOSE,
  SETUP_PURPOSE,
  createPasswordToken,
  passwordChangeAllowed,
  verifyPasswordToken,
} from "@/lib/auth/password-token";

describe("password reset tokens", () => {
  it("lets a reset link replace a password that is already set", () => {
    expect(passwordChangeAllowed(RESET_PURPOSE, false)).toBe(true);
    expect(passwordChangeAllowed(RESET_PURPOSE, true)).toBe(true);
  });

  it("keeps first-time setup from running again after a password exists", () => {
    expect(passwordChangeAllowed(SETUP_PURPOSE, true)).toBe(true);
    expect(passwordChangeAllowed(SETUP_PURPOSE, false)).toBe(false);
  });

  it("round-trips a reset token without accepting another purpose", async () => {
    const { token } = await createPasswordToken({
      userId: "user_1",
      email: "Owner@GrantsAndCo.com",
      purpose: RESET_PURPOSE,
    });
    const claims = await verifyPasswordToken(token);
    expect(claims).toEqual({
      purpose: RESET_PURPOSE,
      uid: "user_1",
      email: "owner@grantsandco.com",
    });

    const setup = await createPasswordToken({
      userId: "user_1",
      email: "owner@grantsandco.com",
      purpose: SETUP_PURPOSE,
    });
    expect((await verifyPasswordToken(setup.token))?.purpose).toBe(SETUP_PURPOSE);
    expect(await verifyPasswordToken("not-a-token")).toBeNull();
  });

  it("puts a forgot-password link on the sign-in form", () => {
    const form = fs.readFileSync(
      path.join(process.cwd(), "src/components/auth/LoginForm.tsx"),
      "utf8",
    );
    expect(form).toMatch(/href="\/forgot-password"/);
    expect(form).toMatch(/Forgot password\?/);
  });
});
