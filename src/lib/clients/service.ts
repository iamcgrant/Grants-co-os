import { prisma } from "@/lib/db/prisma";
import {
  nextGrantsClientId,
  normalizeEmail,
  normalizePhone,
} from "./identity";
import { addTimelineEvent } from "./timeline";
import { writeAuditLog } from "@/lib/audit/log";

export type CreateClientInput = {
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  notes?: string;
  actorId?: string;
  forceCreate?: boolean;
};

export type DuplicateMatch = {
  id: string;
  grantsClientId: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
};

/**
 * Create a Grants Master Client with duplicate prevention at the data layer.
 */
export async function createClient(input: CreateClientInput) {
  const emailNormalized = normalizeEmail(input.email);
  const phoneNormalized = normalizePhone(input.phone);

  const duplicates = await findPossibleDuplicates(emailNormalized, phoneNormalized);
  if (duplicates.length > 0 && !input.forceCreate) {
    return {
      status: "POSSIBLE_DUPLICATE" as const,
      duplicates,
    };
  }

  const grantsClientId = await nextGrantsClientId();

  const client = await prisma.client.create({
    data: {
      grantsClientId,
      email: input.email.trim(),
      emailNormalized,
      phone: input.phone?.trim() || null,
      phoneNormalized,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      notes: input.notes,
      duplicateFlag: duplicates.length > 0,
    },
  });

  await addTimelineEvent({
    clientId: client.id,
    actorId: input.actorId,
    eventType: "CLIENT_CREATED",
    title: "Client Created",
    description: `${client.firstName} ${client.lastName} · ${client.grantsClientId}`,
    idempotencyKey: `client_created:${client.id}`,
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "CLIENT_CREATED",
    entityType: "Client",
    entityId: client.id,
    metadata: { grantsClientId },
  });

  return { status: "CREATED" as const, client };
}

export async function findPossibleDuplicates(
  emailNormalized: string,
  phoneNormalized: string | null,
): Promise<DuplicateMatch[]> {
  const byEmail = await prisma.client.findMany({
    where: { emailNormalized },
    select: {
      id: true,
      grantsClientId: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
    },
  });

  const byPhone =
    phoneNormalized
      ? await prisma.client.findMany({
          where: { phoneNormalized },
          select: {
            id: true,
            grantsClientId: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        })
      : [];

  const map = new Map<string, DuplicateMatch>();
  for (const c of [...byEmail, ...byPhone]) map.set(c.id, c);
  return [...map.values()];
}

export async function attachServiceToClient(input: {
  clientId: string;
  serviceId: string;
  billingPolicyId: string;
  actorId?: string;
  milestoneName?: string;
}) {
  const policy = await prisma.billingPolicy.findUniqueOrThrow({
    where: { id: input.billingPolicyId },
  });

  const clientService = await prisma.clientService.create({
    data: {
      clientId: input.clientId,
      serviceId: input.serviceId,
      billingPolicyId: input.billingPolicyId,
      milestones: {
        create: [
          {
            billingPolicyId: policy.id,
            name: input.milestoneName || "Initial Service Milestone",
            sequence: 1,
            invoiceEligible: policy.type === "MANUAL_INVOICE" ? false : false,
          },
        ],
      },
    },
    include: { service: true, milestones: true },
  });

  await addTimelineEvent({
    clientId: input.clientId,
    actorId: input.actorId,
    eventType: "SERVICE_ADDED",
    title: "Service Added",
    description: clientService.service.name,
    idempotencyKey: `service_added:${clientService.id}`,
  });

  return clientService;
}

export async function attachExternalIdentifier(input: {
  clientId: string;
  provider: string;
  externalId: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.clientIdentifier.upsert({
    where: {
      provider_externalId: {
        provider: input.provider,
        externalId: input.externalId,
      },
    },
    create: {
      clientId: input.clientId,
      provider: input.provider,
      externalId: input.externalId,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
    update: {
      clientId: input.clientId,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}
