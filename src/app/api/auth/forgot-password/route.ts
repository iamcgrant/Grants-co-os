import { NextResponse } from "next/server";
import { z } from "zod";
import { deliverPasswordResetEmail } from "@/lib/auth/password-reset-mail";
import {
  RESET_PURPOSE,
  buildSetPasswordUrl,
  createPasswordToken,
} from "@/lib/auth/password-token";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({
  email: z.string().email(),
});

const GENERIC = {
  ok: true,
  message:
    "If that email belongs to an active account, a reset link is on its way. It expires in 24 hours.",
};

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (user?.isActive) {
      const { token } = await createPasswordToken({
        userId: user.id,
        email: user.email,
        purpose: RESET_PURPOSE,
      });
      const base =
        process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://os.grantandconsultants.com";
      const url = buildSetPasswordUrl(base, token);
      const sent = await deliverPasswordResetEmail({
        to: user.email,
        url,
        firstName: user.firstName,
      });

      await writeAuditLog({
        actorId: user.id,
        action: sent ? "PASSWORD_RESET_EMAIL_SENT" : "PASSWORD_RESET_EMAIL_UNAVAILABLE",
        entityType: "User",
        entityId: user.id,
      });
    }

    return NextResponse.json(GENERIC);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter the email on your account." }, { status: 400 });
    }
    return NextResponse.json(GENERIC);
  }
}
