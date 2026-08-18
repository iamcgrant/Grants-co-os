import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword, createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/log";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    if (!user.isActive) {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    if (user.mustChangePassword) {
      return NextResponse.json(
        {
          error:
            "First-time password setup required. Open the Owner setup link you were sent, then sign in.",
        },
        { status: 403 },
      );
    }

    await createSession(user.id, {
      userAgent: req.headers.get("user-agent") || undefined,
    });

    await writeAuditLog({
      actorId: user.id,
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
