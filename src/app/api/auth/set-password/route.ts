import { NextResponse } from "next/server";
import { z } from "zod";
import {
  verifyPasswordSetupToken,
} from "@/lib/auth/password-setup";
import { createSession, hashPassword } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import {
  getProductionDatabaseRefusal,
  isProductionDatabaseNotConfigured,
  productionDatabaseErrorBody,
} from "@/lib/db/production-guard";

const schema = z.object({
  token: z.string().min(20),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(128)
    .regex(/[A-Z]/, "Include at least one uppercase letter")
    .regex(/[a-z]/, "Include at least one lowercase letter")
    .regex(/[0-9]/, "Include at least one number")
    .regex(/[^A-Za-z0-9]/, "Include at least one symbol"),
  confirmPassword: z.string().min(1),
});

/** Public: validate a first-time password setup token (no secrets returned). */
export async function GET(req: Request) {
  if (getProductionDatabaseRefusal()) {
    return NextResponse.json(
      { ...productionDatabaseErrorBody(), valid: false },
      { status: 503 },
    );
  }

  const token = new URL(req.url).searchParams.get("token") || "";
  const claims = await verifyPasswordSetupToken(token);
  if (!claims) {
    return NextResponse.json({ valid: false, error: "Invalid or expired setup link" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
    },
  });

  if (!user || !user.isActive || user.email.toLowerCase() !== claims.email) {
    return NextResponse.json({ valid: false, error: "Account not found" }, { status: 404 });
  }

  if (!user.mustChangePassword) {
    return NextResponse.json({
      valid: false,
      error: "Password already set — sign in at /login",
      alreadyComplete: true,
    });
  }

  return NextResponse.json({
    valid: true,
    email: user.email,
    firstName: user.firstName,
    role: user.role,
  });
}

/** Complete first-time Owner password setup and create a session. */
export async function POST(req: Request) {
  if (getProductionDatabaseRefusal()) {
    return NextResponse.json(productionDatabaseErrorBody(), { status: 503 });
  }

  try {
    const body = schema.parse(await req.json());
    if (body.password !== body.confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }

    const claims = await verifyPasswordSetupToken(body.token);
    if (!claims) {
      return NextResponse.json({ error: "Invalid or expired setup link" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: claims.uid } });
    if (!user || !user.isActive || user.email.toLowerCase() !== claims.email) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (!user.mustChangePassword) {
      return NextResponse.json(
        { error: "Password already set — use the login page" },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(body.password);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    await createSession(updated.id, {
      userAgent: req.headers.get("user-agent") || undefined,
    });

    await writeAuditLog({
      actorId: updated.id,
      action: "PASSWORD_SETUP_COMPLETE",
      entityType: "User",
      entityId: updated.id,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        role: updated.role,
      },
    });
  } catch (e) {
    if (isProductionDatabaseNotConfigured(e)) {
      return NextResponse.json(productionDatabaseErrorBody(), { status: 503 });
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message || "Invalid password" },
        { status: 400 },
      );
    }
    const message = e instanceof Error ? e.message : "Setup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
