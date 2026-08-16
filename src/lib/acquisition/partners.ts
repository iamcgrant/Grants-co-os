/**
 * Engine A — referral partners.
 * A Partner is a business row, never a Client / credit-repair human.
 * No live GHL writes. No Friday / welcome / cold SMS.
 */

import { prisma } from "@/lib/db/prisma";
import { normalizeEmail, normalizePhone } from "@/lib/clients/identity";
import { writeAuditLog } from "@/lib/audit/log";
import {
  ACQUISITION_LOCKS,
  emptyAcquisitionSideEffects,
  type AcquisitionSideEffects,
} from "./locks";
import { parseAcquisitionSource } from "./source";
import { scoreGrantsLead, serializeScoreReasons } from "./score";
import {
  AcquisitionError,
  PARTNER_PIPELINE_STAGES,
  PARTNER_TYPES,
  type AcquisitionSourceValue,
  type PartnerPipelineStageValue,
  type PartnerTypeValue,
} from "./types";
import type { Partner } from "@/generated/prisma/client";

export type CreatePartnerInput = {
  businessName: string;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  email?: string | null;
  phone?: string | null;
  partnerType?: string | null;
  pipelineStage?: string | null;
  acquisitionSource?: string | null;
  notes?: string | null;
  doNotContact?: boolean;
  unsubscribed?: boolean;
  actorId?: string;
  /** Forbidden. Partners are not clients. */
  createClient?: boolean;
  clientId?: string | null;
};

function parsePartnerStage(raw: string | null | undefined): PartnerPipelineStageValue {
  if (raw == null || String(raw).trim() === "") return "NEW_PROSPECT";
  const normalized = String(raw).trim().toUpperCase();
  if (!(PARTNER_PIPELINE_STAGES as readonly string[]).includes(normalized)) {
    throw new AcquisitionError("INVALID_STAGE", `Partner stage '${raw}' is not in PartnerPipelineStage.`);
  }
  return normalized as PartnerPipelineStageValue;
}

function parsePartnerType(raw: string | null | undefined): PartnerTypeValue | null {
  if (raw == null || String(raw).trim() === "") return null;
  const normalized = String(raw).trim().toUpperCase();
  if (!(PARTNER_TYPES as readonly string[]).includes(normalized)) {
    throw new AcquisitionError("INVALID_PARTNER_TYPE", `Partner type '${raw}' is not REALTOR | MORTGAGE | BUILDER | OTHER.`);
  }
  return normalized as PartnerTypeValue;
}

async function assertNotAClient(input: { emailNormalized: string | null; phoneNormalized: string | null; clientId?: string | null }) {
  if (input.clientId) {
    throw new AcquisitionError(
      "REFUSE_MIX_PARTNER_CLIENT",
      "A Partner is a business, not a Client. Do not attach a clientId.",
    );
  }

  const or = [
    ...(input.emailNormalized ? [{ emailNormalized: input.emailNormalized }] : []),
    ...(input.phoneNormalized ? [{ phoneNormalized: input.phoneNormalized }] : []),
  ];
  if (or.length === 0) return;

  const existingClient = await prisma.client.findFirst({ where: { OR: or }, select: { id: true } });
  if (existingClient) {
    throw new AcquisitionError(
      "REFUSE_MIX_PARTNER_CLIENT",
      "Refusing to create a Partner from a credit-repair Client identity. Engines stay separate.",
    );
  }
}

/**
 * Create a referral-partner business row. Never inserts a Client.
 */
export async function createPartner(
  input: CreatePartnerInput,
): Promise<{ partner: Partner; sideEffects: AcquisitionSideEffects }> {
  if (input.createClient) {
    throw new AcquisitionError(
      "PARTNER_IS_NOT_A_CLIENT",
      "Partners are not Clients. createClient is refused.",
    );
  }
  if (!ACQUISITION_LOCKS.enginesSeparated || ACQUISITION_LOCKS.partnerIsClient) {
    throw new AcquisitionError("REFUSE_MIX_PARTNER_CLIENT", "Partner/client engines must stay separated.");
  }

  const businessName = input.businessName.trim();
  if (!businessName) {
    throw new AcquisitionError("INVALID_PARTNER_TYPE", "Partner businessName is required.");
  }

  const emailNormalized = input.email ? normalizeEmail(input.email) : null;
  const phoneNormalized = normalizePhone(input.phone);
  await assertNotAClient({
    emailNormalized,
    phoneNormalized,
    clientId: input.clientId,
  });

  const source = parseAcquisitionSource(input.acquisitionSource);
  const stage = parsePartnerStage(input.pipelineStage);
  const partnerType = parsePartnerType(input.partnerType);
  const scored = scoreGrantsLead({
    acquisitionStage: stage,
    acquisitionSource: source,
    doNotContact: Boolean(input.doNotContact),
    unsubscribed: Boolean(input.unsubscribed),
  });

  const partner = await prisma.partner.create({
    data: {
      businessName,
      contactFirstName: input.contactFirstName?.trim() || null,
      contactLastName: input.contactLastName?.trim() || null,
      email: input.email?.trim() || null,
      emailNormalized,
      phone: input.phone?.trim() || null,
      phoneNormalized,
      partnerType,
      pipelineStage: stage,
      acquisitionSource: source,
      grantsLeadScore: scored.score,
      grantsLeadScoreReasonsJson: serializeScoreReasons(scored.reasons),
      doNotContact: Boolean(input.doNotContact),
      unsubscribed: Boolean(input.unsubscribed),
      notes: input.notes?.trim() || null,
    },
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "PARTNER_CREATED",
    entityType: "Partner",
    entityId: partner.id,
    metadata: { businessName, pipelineStage: stage },
  });

  return { partner, sideEffects: emptyAcquisitionSideEffects() };
}

export async function updatePartnerStage(input: {
  partnerId: string;
  pipelineStage: string;
  actorId?: string;
}): Promise<Partner> {
  const partner = await prisma.partner.findUnique({ where: { id: input.partnerId } });
  if (!partner) {
    throw new AcquisitionError("CLIENT_NOT_FOUND", "Partner not found.");
  }

  const stage = parsePartnerStage(input.pipelineStage);
  const doNotContact = partner.doNotContact;
  const unsubscribed = partner.unsubscribed;

  const scored = scoreGrantsLead({
    acquisitionStage: stage,
    acquisitionSource: partner.acquisitionSource as AcquisitionSourceValue | null,
    doNotContact,
    unsubscribed,
  });

  return prisma.partner.update({
    where: { id: partner.id },
    data: {
      pipelineStage: stage,
      doNotContact,
      unsubscribed,
      grantsLeadScore: scored.score,
      grantsLeadScoreReasonsJson: serializeScoreReasons(scored.reasons),
    },
  });
}

export async function preservePartnerCommsFlags(input: {
  partnerId: string;
  doNotContact?: boolean;
  unsubscribed?: boolean;
}): Promise<Partner> {
  const partner = await prisma.partner.findUnique({ where: { id: input.partnerId } });
  if (!partner) {
    throw new AcquisitionError("CLIENT_NOT_FOUND", "Partner not found.");
  }

  return prisma.partner.update({
    where: { id: partner.id },
    data: {
      doNotContact: partner.doNotContact || Boolean(input.doNotContact),
      unsubscribed: partner.unsubscribed || Boolean(input.unsubscribed),
    },
  });
}
