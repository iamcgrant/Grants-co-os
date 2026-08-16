import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { createClient } from "@/lib/clients/service";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user.role, "VIEW_CLIENT");
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        grantsClientId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ clients });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

const createSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  notes: z.string().optional(),
  forceCreate: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "CREATE_CLIENT");
    const body = createSchema.parse(await req.json());
    const result = await createClient({ ...body, actorId: user.id });
    return NextResponse.json(result, {
      status: result.status === "CREATED" ? 201 : 409,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
