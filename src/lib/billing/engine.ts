import { prisma } from "@/lib/db/prisma";
import { nextInvoiceNumber } from "@/lib/clients/identity";
import { addTimelineEvent } from "@/lib/clients/timeline";
import type { BillingPolicyType } from "@/generated/prisma/client";

export async function completeMilestone(input: {
  milestoneId: string;
  completedByUserId: string;
  supportingDocumentId?: string;
}) {
  const milestone = await prisma.serviceMilestone.findUnique({
    where: { id: input.milestoneId },
    include: {
      billingPolicy: true,
      clientService: { include: { service: true, client: true } },
    },
  });
  if (!milestone) throw new Error("Milestone not found");
  if (milestone.isCompleted) return milestone;

  const policyType = milestone.billingPolicy.type;
  const becomesEligible = isBillableAfterMilestone(policyType);

  const updated = await prisma.serviceMilestone.update({
    where: { id: milestone.id },
    data: {
      isCompleted: true,
      completedAt: new Date(),
      completedByUserId: input.completedByUserId,
      supportingDocumentId: input.supportingDocumentId,
      invoiceEligible: becomesEligible,
      paymentEligible: becomesEligible,
    },
  });

  await addTimelineEvent({
    clientId: milestone.clientService.clientId,
    actorId: input.completedByUserId,
    eventType: "MILESTONE_COMPLETED",
    title: "Milestone Completed",
    description: milestone.name,
    idempotencyKey: `milestone_complete:${milestone.id}`,
  });

  return updated;
}

export function isBillableAfterMilestone(type: BillingPolicyType): boolean {
  return (
    type === "AFTER_SERVICE_MILESTONE" ||
    type === "RECURRING_AFTER_MILESTONE" ||
    type === "PAY_PER_COMPLETED_SERVICE"
  );
}

export async function createInvoiceFromMilestone(input: {
  milestoneId: string;
  actorId?: string;
  amountCents?: number;
}) {
  const milestone = await prisma.serviceMilestone.findUnique({
    where: { id: input.milestoneId },
    include: {
      billingPolicy: true,
      clientService: { include: { service: true, client: true } },
    },
  });
  if (!milestone) throw new Error("Milestone not found");
  if (!milestone.isCompleted) throw new Error("Milestone not completed");
  if (!milestone.invoiceEligible) {
    throw new Error("Milestone is not invoice-eligible under current billing policy");
  }
  if (milestone.invoiceCreated) {
    const existing = await prisma.invoice.findFirst({
      where: { milestoneId: milestone.id },
    });
    if (existing) return existing;
  }

  const amountCents =
    input.amountCents ??
    milestone.billingPolicy.amountCents ??
    milestone.clientService.service.basePriceCents;

  const invoiceNumber = await nextInvoiceNumber();

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        invoiceNumber,
        clientId: milestone.clientService.clientId,
        clientServiceId: milestone.clientServiceId,
        milestoneId: milestone.id,
        status: "DUE",
        amountCents,
        description: `${milestone.clientService.service.name} — ${milestone.name}`,
        dueAt: new Date(),
        items: {
          create: [
            {
              description: `${milestone.clientService.service.name} — ${milestone.name}`,
              quantity: 1,
              unitCents: amountCents,
              totalCents: amountCents,
            },
          ],
        },
      },
    });

    await tx.serviceMilestone.update({
      where: { id: milestone.id },
      data: { invoiceCreated: true },
    });

    return created;
  });

  await addTimelineEvent({
    clientId: milestone.clientService.clientId,
    actorId: input.actorId,
    eventType: "INVOICE_CREATED",
    title: "Invoice Created",
    description: `Invoice ${invoice.invoiceNumber} for $${(amountCents / 100).toFixed(2)}`,
    idempotencyKey: `invoice:${invoice.id}`,
  });

  return invoice;
}

export async function createManualInvoice(input: {
  clientId: string;
  clientServiceId?: string;
  amountCents: number;
  description: string;
  actorId?: string;
}) {
  const invoiceNumber = await nextInvoiceNumber();
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      clientId: input.clientId,
      clientServiceId: input.clientServiceId,
      status: "DUE",
      amountCents: input.amountCents,
      description: input.description,
      dueAt: new Date(),
      items: {
        create: [
          {
            description: input.description,
            quantity: 1,
            unitCents: input.amountCents,
            totalCents: input.amountCents,
          },
        ],
      },
    },
  });

  await addTimelineEvent({
    clientId: input.clientId,
    actorId: input.actorId,
    eventType: "INVOICE_CREATED",
    title: "Invoice Created",
    description: `Invoice ${invoice.invoiceNumber}`,
    idempotencyKey: `invoice:${invoice.id}`,
  });

  return invoice;
}
