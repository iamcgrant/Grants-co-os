import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { attachServiceToClient } from "@/lib/clients/service";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({
  serviceId: z.string().optional(),
  billingPolicyId: z.string().optional(),
  milestoneName: z.string().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "CREATE_CLIENT");
    const { id } = await ctx.params;
    const body = schema.parse(await req.json().catch(() => ({})));

    const client = await prisma.client.findFirst({
      where: { OR: [{ id }, { grantsClientId: id }] },
    });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    let serviceId = body.serviceId;
    let billingPolicyId = body.billingPolicyId;

    if (!serviceId || !billingPolicyId) {
      const service = await prisma.service.findFirst({
        where: { code: "CREDIT_OPT" },
        include: { billingPolicies: true },
      });
      if (!service) return NextResponse.json({ error: "Service not configured" }, { status: 400 });
      serviceId = serviceId || service.id;
      billingPolicyId =
        billingPolicyId ||
        service.billingPolicies.find((p) => p.type === "AFTER_SERVICE_MILESTONE")?.id ||
        service.billingPolicies[0]?.id;
    }

    const clientService = await attachServiceToClient({
      clientId: client.id,
      serviceId: serviceId!,
      billingPolicyId: billingPolicyId!,
      actorId: user.id,
      milestoneName: body.milestoneName,
    });

    return NextResponse.json({ clientService }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
