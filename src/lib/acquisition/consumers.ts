/**
 * Engine B — direct consumers.
 * A consumer lead is a Client (acquisitionStage). Conversion never creates a second master.
 * Paid consumers attach to the existing onboarding checklist. No Friday / welcome / SMS / GHL.
 */

import { prisma } from "@/lib/db/prisma";
import { createClient, findPossibleDuplicates } from "@/lib/clients/service";
import { normalizeEmail, normalizePhone } from "@/lib/clients/identity";
import { MASTER_ONBOARDING_ITEMS } from "@/lib/clients/onboarding";
import { addTimelineEvent } from "@/lib/clients/timeline";
import { writeAuditLog } from "@/lib/audit/log";
import { recordLeadAttribution } from "@/lib/marketing/lead-attribution";
import {
  ACQUISITION_LOCKS,
  emptyAcquisitionSideEffects,
  type AcquisitionSideEffects,
} from "./locks";
import { mapAcquisitionSourceToAttribution, parseAcquisitionSource } from "./source";
import { scoreGrantsLead, serializeScoreReasons } from "./score";
import {
  AcquisitionError,
  CONSUMER_LEAD_STAGES,
  CONVERTED_CONSUMER_STAGES,
  type AcquisitionSourceValue,
  type ConsumerLeadStageValue,
} from "./types";
import type { Client, PartnerReferral } from "@/generated/prisma/client";

export type OpenConsumerLeadInput = {
  clientId?: string | null;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  acquisitionStage?: string | null;
  acquisitionSource?: string | null;
  referredByPartnerId?: string | null;
  doNotContact?: boolean;
  unsubscribed?: boolean;
  campaignId?: string | null;
  campaignName?: string | null;
  contentId?: string | null;
  adId?: string | null;
  cta?: string | null;
  actorId?: string;
  /** Forbidden on convert. Allowed only to open the first master for a new human. */
  createClient?: boolean;
};

export type ConvertConsumerLeadInput = {
  clientId: string;
  actorId?: string;
  createClient?: boolean;
  /** Must not be used to mint a second person. */
  email?: string;
  firstName?: string;
  lastName?: string;
  paid?: boolean;
};

function parseConsumerStage(raw: string | null | undefined): ConsumerLeadStageValue {
  if (raw == null || String(raw).trim() === "") return "NEW_LEAD";
  const normalized = String(raw).trim().toUpperCase();
  if (!(CONSUMER_LEAD_STAGES as readonly string[]).includes(normalized)) {
    throw new AcquisitionError("INVALID_STAGE", `Consumer stage '${raw}' is not in ConsumerLeadStage.`);
  }
  return normalized as ConsumerLeadStageValue;
}

async function applyScoreAndFlags(
  clientId: string,
  patch: {
    acquisitionStage: ConsumerLeadStageValue;
    acquisitionSource: AcquisitionSourceValue | null;
    doNotContact: boolean;
    unsubscribed: boolean;
    referredByPartnerId?: string | null;
    lastInteractionAt?: Date;
  },
) {
  const intakeCompleteCount = await prisma.onboardingItem.count({
    where: { clientId, status: "COMPLETE" },
  });
  const scored = scoreGrantsLead({
    acquisitionStage: patch.acquisitionStage,
    acquisitionSource: patch.acquisitionSource,
    doNotContact: patch.doNotContact,
    unsubscribed: patch.unsubscribed,
    lastInteractionAt: patch.lastInteractionAt ?? new Date(),
    intakeCompleteCount,
  });

  return prisma.client.update({
    where: { id: clientId },
    data: {
      acquisitionStage: patch.acquisitionStage,
      acquisitionSource: patch.acquisitionSource,
      referredByPartnerId: patch.referredByPartnerId ?? undefined,
      doNotContact: patch.doNotContact,
      unsubscribed: patch.unsubscribed,
      grantsLeadScore: scored.score,
      grantsLeadScoreReasonsJson: serializeScoreReasons(scored.reasons),
      lastInteractionAt: patch.lastInteractionAt ?? new Date(),
    },
  });
}

async function attachAttributionIfStamped(input: {
  clientId: string;
  source: AcquisitionSourceValue | null;
  campaignId?: string | null;
  campaignName?: string | null;
  contentId?: string | null;
  adId?: string | null;
  cta?: string | null;
}) {
  const hasStamp = Boolean(
    input.campaignId?.trim() ||
      input.contentId?.trim() ||
      input.adId?.trim() ||
      input.cta?.trim() ||
      input.source,
  );
  if (!hasStamp) return null;

  return recordLeadAttribution({
    clientId: input.clientId,
    source: mapAcquisitionSourceToAttribution(input.source),
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    contentId: input.contentId,
    adId: input.adId,
    cta: input.cta,
  });
}

/**
 * Open or attach a consumer lead on an existing master.
 * Matching email/phone reuses the master. A new human may create the first Client only.
 */
export async function openConsumerLead(
  input: OpenConsumerLeadInput,
): Promise<{ client: Client; created: boolean; sideEffects: AcquisitionSideEffects }> {
  if (!ACQUISITION_LOCKS.oneHumanOneMaster) {
    throw new AcquisitionError("REFUSE_SECOND_MASTER", "ONE HUMAN = ONE MASTER is locked.");
  }

  const source = parseAcquisitionSource(input.acquisitionSource);
  const stage = parseConsumerStage(input.acquisitionStage);
  const emailNormalized = input.email ? normalizeEmail(input.email) : null;
  const phoneNormalized = normalizePhone(input.phone);

  if (input.referredByPartnerId) {
    const partner = await prisma.partner.findUnique({
      where: { id: input.referredByPartnerId },
    });
    if (!partner) {
      throw new AcquisitionError("REFUSE_MIX_PARTNER_CLIENT", "referredByPartnerId is not a Partner.");
    }
    const asClient = await prisma.client.findUnique({ where: { id: partner.id } });
    if (asClient) {
      throw new AcquisitionError("PARTNER_IS_NOT_A_CLIENT", "Partner id collided with a Client id.");
    }
  }

  let client: Client | null = null;
  let createdMaster = false;
  if (input.clientId?.trim()) {
    client = await prisma.client.findUnique({ where: { id: input.clientId.trim() } });
    if (!client) {
      throw new AcquisitionError(
        "CLIENT_NOT_FOUND",
        "Consumer lead attaches to an existing master only when clientId is set. No second client was created.",
      );
    }
  } else if (emailNormalized || phoneNormalized) {
    const duplicates = await findPossibleDuplicates(emailNormalized || "", phoneNormalized);
    if (duplicates.length > 0) {
      client = await prisma.client.findUnique({ where: { id: duplicates[0]!.id } });
    }
  }

  if (!client) {
    if (!input.email || !input.firstName || !input.lastName) {
      throw new AcquisitionError(
        "CLIENT_REQUIRED",
        "A consumer lead needs an existing Client or email + name to open the first master.",
      );
    }
    const opened = await createClient({
      email: input.email,
      phone: input.phone,
      firstName: input.firstName,
      lastName: input.lastName,
      actorId: input.actorId,
    });
    if (opened.status === "POSSIBLE_DUPLICATE") {
      client = await prisma.client.findUnique({ where: { id: opened.duplicates[0]!.id } });
      if (!client) {
        throw new AcquisitionError("REFUSE_SECOND_MASTER", "Duplicate master exists; refusing a second Client.");
      }
    } else {
      client = opened.client;
      createdMaster = true;
    }
  }

  const updated = await applyScoreAndFlags(client.id, {
    acquisitionStage: input.acquisitionStage ? stage : (client.acquisitionStage ?? stage),
    acquisitionSource: source ?? (client.acquisitionSource as AcquisitionSourceValue | null),
    doNotContact: client.doNotContact || Boolean(input.doNotContact),
    unsubscribed: client.unsubscribed || Boolean(input.unsubscribed),
    referredByPartnerId: input.referredByPartnerId ?? client.referredByPartnerId,
  });

  await attachAttributionIfStamped({
    clientId: updated.id,
    source: updated.acquisitionSource as AcquisitionSourceValue | null,
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    contentId: input.contentId,
    adId: input.adId,
    cta: input.cta,
  });

  return {
    client: updated,
    created: createdMaster,
    sideEffects: emptyAcquisitionSideEffects(),
  };
}

/**
 * Attach the existing master onboarding checklist. Never a second path.
 * Completed items are not overwritten.
 */
export async function ensureExistingMasterOnboarding(clientId: string) {
  if (ACQUISITION_LOCKS.secondOnboardingPath) {
    throw new AcquisitionError("REFUSE_LIVE_SIDE_EFFECT", "Second onboarding path is locked off.");
  }

  for (const item of MASTER_ONBOARDING_ITEMS) {
    await prisma.onboardingItem.upsert({
      where: { clientId_key: { clientId, key: item.key } },
      create: {
        clientId,
        key: item.key,
        label: item.label,
        status: "MISSING",
      },
      update: {},
    });
  }
}

/**
 * Convert a consumer lead on the same master. Never creates a Client.
 * PartnerReferral is written only after conversion. Friday / welcome stay off.
 */
export async function convertConsumerLead(
  input: ConvertConsumerLeadInput,
): Promise<{
  client: Client;
  referral: PartnerReferral | null;
  sideEffects: AcquisitionSideEffects;
}> {
  if (input.createClient) {
    throw new AcquisitionError(
      "REFUSE_CREATE_CLIENT",
      "Conversion cannot create a client. ONE HUMAN = ONE MASTER.",
    );
  }

  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) {
    throw new AcquisitionError(
      "CLIENT_NOT_FOUND",
      "Conversion requires an existing master. No client was created.",
    );
  }

  const nextStage: ConsumerLeadStageValue = input.paid === false ? "PAYMENT_PENDING" : "PAID_ONBOARDING";
  const opsStage =
    client.stage === "NEW_ENROLLMENT" || client.stage === "NEW_LEAD" || !client.stage
      ? "ONBOARDING"
      : client.stage;

  await ensureExistingMasterOnboarding(client.id);

  const updated = await applyScoreAndFlags(client.id, {
    acquisitionStage: nextStage,
    acquisitionSource: client.acquisitionSource as AcquisitionSourceValue | null,
    doNotContact: client.doNotContact,
    unsubscribed: client.unsubscribed,
    referredByPartnerId: client.referredByPartnerId,
  });

  if (opsStage !== client.stage) {
    await prisma.client.update({
      where: { id: client.id },
      data: { stage: opsStage },
    });
  }

  let referral: PartnerReferral | null = null;
  if (client.referredByPartnerId && CONVERTED_CONSUMER_STAGES.includes(nextStage)) {
    referral = await prisma.partnerReferral.upsert({
      where: {
        partnerId_clientId: {
          partnerId: client.referredByPartnerId,
          clientId: client.id,
        },
      },
      create: {
        partnerId: client.referredByPartnerId,
        clientId: client.id,
      },
      update: {},
    });

    const partner = await prisma.partner.findUnique({ where: { id: client.referredByPartnerId } });
    if (partner && !partner.doNotContact && !partner.unsubscribed) {
      const nextPartnerStage =
        partner.pipelineStage === "ACTIVE_PRODUCING_PARTNER"
          ? partner.pipelineStage
          : partner.pipelineStage === "REFERRED_FIRST_CLIENT" ||
              partner.pipelineStage === "ACTIVE_REFERRAL_PARTNER"
            ? "ACTIVE_PRODUCING_PARTNER"
            : "REFERRED_FIRST_CLIENT";
      await prisma.partner.update({
        where: { id: partner.id },
        data: { pipelineStage: nextPartnerStage },
      });
    }
  }

  await addTimelineEvent({
    clientId: client.id,
    actorId: input.actorId,
    eventType: "CONSUMER_LEAD_CONVERTED",
    title: "Consumer lead converted",
    description: "Paid consumer connected to existing master intake. No second client.",
    idempotencyKey: `consumer_converted:${client.id}:${nextStage}`,
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "CONSUMER_LEAD_CONVERTED",
    entityType: "Client",
    entityId: client.id,
    metadata: { acquisitionStage: nextStage, friday: false, welcome: false },
  });

  const reloaded = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
  return { client: reloaded, referral, sideEffects: emptyAcquisitionSideEffects() };
}

export async function preserveClientCommsFlags(input: {
  clientId: string;
  doNotContact?: boolean;
  unsubscribed?: boolean;
}): Promise<Client> {
  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) {
    throw new AcquisitionError("CLIENT_NOT_FOUND", "Client not found.");
  }

  return prisma.client.update({
    where: { id: input.clientId },
    data: {
      doNotContact: client.doNotContact || Boolean(input.doNotContact),
      unsubscribed: client.unsubscribed || Boolean(input.unsubscribed),
    },
  });
}
