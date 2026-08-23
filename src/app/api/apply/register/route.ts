import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@/generated/prisma/client";
import { hashPassword, createSession, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/clients/service";
import { normalizeEmail } from "@/lib/clients/identity";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
});

/** POST /api/apply/register — borrower account + master client for mortgage apply flow */
export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const emailNormalized = normalizeEmail(body.email);

    const existingUser = await prisma.user.findUnique({ where: { email: emailNormalized } });
    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists. Sign in to continue." }, { status: 409 });
    }

    const clientResult = await createClient({
      email: body.email,
      phone: body.phone,
      firstName: body.firstName,
      lastName: body.lastName,
      forceCreate: true,
    });

    if (clientResult.status !== "CREATED") {
      return NextResponse.json({ error: "Unable to create client record" }, { status: 400 });
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        email: emailNormalized,
        passwordHash,
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        role: Role.CLIENT,
      },
    });

    await prisma.client.update({
      where: { id: clientResult.client.id },
      data: { userId: user.id },
    });

    await createSession(user.id, {
      userAgent: req.headers.get("user-agent") || undefined,
      rememberMe: true,
    });

    return NextResponse.json({
      clientId: clientResult.client.id,
      grantsClientId: clientResult.client.grantsClientId,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Registration failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** GET /api/apply/register — current borrower session + active application */
export async function GET() {
  try {
    const user = await requireUser([Role.CLIENT]);
    const client = await prisma.client.findFirst({
      where: { userId: user.id },
      select: { id: true, grantsClientId: true, firstName: true, lastName: true, email: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
    }

    const application = await prisma.mortgageApplication.findFirst({
      where: { clientId: client.id, serviceCode: "MORTGAGE_LOS" },
      orderBy: { createdAt: "desc" },
      include: { loanFile: true },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      client,
      application: application
        ? {
            applicationId: application.id,
            submittedAt: application.submittedAt,
            loanFile: application.loanFile
              ? {
                  loanNumber: application.loanFile.loanNumber,
                  originationStage: application.loanFile.originationStage,
                }
              : null,
          }
        : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
