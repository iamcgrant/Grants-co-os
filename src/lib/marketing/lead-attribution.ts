/**
 * Fail-closed LeadAttribution on an existing Grants master client.
 *
 * Rules:
 * - ONE HUMAN = ONE MASTER. Attribution is a child row, never a second client.
 * - Do not create leads, contacts, or clients from marketing/attribution.
 * - Do not invent source, campaign, or amountCollected.
 * - Missing intake stamp = DATA UNAVAILABLE, not "organic".
 * - unknown stays unknown — never coerced to organic/direct.
 * - amountCollected stays null without a verified X5 / Jobber / Authorize.Net payment fact.
 * - Do not overwrite newer verified payment data with guessed ad revenue.
 *
 * Live GHL / DisputeFox intake is not wired here. Production intake is DisputeFox.
 * Stamp landing comments live on those inbound attach paths.
 */

import { prisma } from "@/lib/db/prisma";
import type { AttributionShowStatus, AttributionSource, LeadAttribution } from "@/generated/prisma/client";
import {
  parseAcquisitionMarket,
  type AcquisitionMarketValue,
} from "@/lib/acquisition/markets";
import { AcquisitionError } from "@/lib/acquisition/types";

export const DATA_UNAVAILABLE = "DATA_UNAVAILABLE" as const;

export const ATTRIBUTION_SOURCES = [
  "facebook",
  "instagram",
  "youtube",
  "email",
  "referral",
  "direct",
  "unknown",
] as const;

export const SHOW_STATUSES = ["showed", "no_show", "unknown"] as const;

export const VERIFIED_PAYMENT_PROVIDERS = ["X5", "JOBBER", "AUTHORIZE_NET"] as const;

export type AttributionSourceValue = (typeof ATTRIBUTION_SOURCES)[number];
export type ShowStatusValue = (typeof SHOW_STATUSES)[number];
export type VerifiedPaymentProvider = (typeof VERIFIED_PAYMENT_PROVIDERS)[number];

export type RevenueByContentStatus = typeof DATA_UNAVAILABLE | "AVAILABLE";

export class LeadAttributionError extends Error {
  constructor(
    public code:
      | "CLIENT_REQUIRED"
      | "CLIENT_NOT_FOUND"
      | "REFUSE_CREATE_CLIENT"
      | "INVALID_SOURCE"
      | "INVALID_MARKET"
      | "INVALID_SHOW_STATUS"
      | "PAYMENT_FACT_REQUIRED"
      | "PAYMENT_FACT_MISMATCH"
      | "REFUSE_OVERWRITE_NEWER_PAYMENT",
    message: string,
  ) {
    super(message);
    this.name = "LeadAttributionError";
  }
}

export type RecordLeadAttributionInput = {
  clientId?: string | null;
  /** Forbidden. Attribution never creates a Grants client. */
  createClient?: boolean;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  source?: string | null;
  platform?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  contentId?: string | null;
  adId?: string | null;
  cta?: string | null;
  leadAt?: Date | null;
  consultBookedAt?: Date | null;
  showStatus?: string | null;
  converted?: boolean | null;
  service?: string | null;
  /** Optional locked city/market. Unstamped market keeps revenue-by-market DATA UNAVAILABLE. */
  market?: string | null;
  /** Ignored unless a verified payment fact is supplied. */
  amountCollected?: number | null;
  paymentTransactionId?: string | null;
};

export type ApplyVerifiedAmountInput = {
  attributionId: string;
  paymentTransactionId: string;
  /** Guessed ad revenue — never written. Amount comes from the payment fact. */
  guessedAdRevenueCents?: number | null;
};

function isAttributionSource(value: string): value is AttributionSourceValue {
  return (ATTRIBUTION_SOURCES as readonly string[]).includes(value);
}

function isShowStatus(value: string): value is ShowStatusValue {
  return (SHOW_STATUSES as readonly string[]).includes(value);
}

/**
 * Fail-closed source parse. Blank/missing → unknown (not organic).
 * "organic" and any other label are refused — never coerced.
 */
export function parseAttributionSource(raw: string | null | undefined): AttributionSource {
  if (raw == null || String(raw).trim() === "") {
    return "unknown";
  }
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === "organic") {
    throw new LeadAttributionError(
      "INVALID_SOURCE",
      "Source 'organic' is not a valid AttributionSource and is not coerced from unknown or a missing stamp.",
    );
  }
  if (!isAttributionSource(normalized)) {
    throw new LeadAttributionError(
      "INVALID_SOURCE",
      `Source '${normalized}' is not in the allow-list. Missing stamp is DATA UNAVAILABLE, not organic.`,
    );
  }
  return normalized;
}

export function parseShowStatus(raw: string | null | undefined): AttributionShowStatus {
  if (raw == null || String(raw).trim() === "") {
    return "unknown";
  }
  const normalized = String(raw).trim().toLowerCase();
  if (!isShowStatus(normalized)) {
    throw new LeadAttributionError(
      "INVALID_SHOW_STATUS",
      `show_status '${normalized}' is not showed | no_show | unknown.`,
    );
  }
  return normalized;
}

/** Revenue-by-content requires campaign + content + ad + CTA stamps. */
export function hasCompleteIntakeStamp(row: {
  campaignId: string | null;
  contentId: string | null;
  adId: string | null;
  cta: string | null;
}): boolean {
  return Boolean(row.campaignId?.trim() && row.contentId?.trim() && row.adId?.trim() && row.cta?.trim());
}

export function revenueByContentStatus(row: {
  campaignId: string | null;
  contentId: string | null;
  adId: string | null;
  cta: string | null;
  amountCollected: number | null;
}): RevenueByContentStatus {
  if (!hasCompleteIntakeStamp(row) || row.amountCollected == null) {
    return DATA_UNAVAILABLE;
  }
  return "AVAILABLE";
}

function refuseCreateClient(input: RecordLeadAttributionInput) {
  if (input.createClient) {
    throw new LeadAttributionError(
      "REFUSE_CREATE_CLIENT",
      "Attribution cannot create a client. ONE HUMAN = ONE MASTER. X2 will not send leads to create.",
    );
  }
}

async function resolveVerifiedAmountCents(input: {
  clientId: string;
  paymentTransactionId?: string | null;
  guessedAmount?: number | null;
}): Promise<number | null> {
  if (!input.paymentTransactionId) {
    return null;
  }

  const tx = await prisma.paymentTransaction.findUnique({
    where: { id: input.paymentTransactionId },
  });
  if (!tx || tx.status !== "SUCCEEDED" || tx.clientId !== input.clientId) {
    throw new LeadAttributionError(
      "PAYMENT_FACT_MISMATCH",
      "amount_collected requires a SUCCEEDED payment transaction on the same master client.",
    );
  }

  void input.guessedAmount;
  return tx.amountCents;
}

/**
 * Attach a LeadAttribution child row to an existing master client.
 * Never creates a Client, LeadSource, GHL contact, or message.
 */
export async function recordLeadAttribution(
  input: RecordLeadAttributionInput,
): Promise<LeadAttribution> {
  refuseCreateClient(input);

  const clientId = input.clientId?.trim();
  if (!clientId) {
    throw new LeadAttributionError(
      "CLIENT_REQUIRED",
      "LeadAttribution requires an existing Client id. No client was created.",
    );
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    throw new LeadAttributionError(
      "CLIENT_NOT_FOUND",
      "LeadAttribution attaches to an existing master only. No client was created.",
    );
  }

  const source = parseAttributionSource(input.source);
  const showStatus = parseShowStatus(input.showStatus);
  let market: AcquisitionMarketValue | null = null;
  try {
    market = parseAcquisitionMarket(input.market);
  } catch (error) {
    if (error instanceof AcquisitionError) {
      throw new LeadAttributionError("INVALID_MARKET", error.message);
    }
    throw error;
  }
  const amountCollected = await resolveVerifiedAmountCents({
    clientId: client.id,
    paymentTransactionId: input.paymentTransactionId,
    guessedAmount: input.amountCollected,
  });

  return prisma.leadAttribution.create({
    data: {
      clientId: client.id,
      source,
      platform: input.platform?.trim() || null,
      campaignId: input.campaignId?.trim() || null,
      campaignName: input.campaignName?.trim() || null,
      contentId: input.contentId?.trim() || null,
      adId: input.adId?.trim() || null,
      cta: input.cta?.trim() || null,
      leadAt: input.leadAt ?? null,
      consultBookedAt: input.consultBookedAt ?? null,
      showStatus,
      converted: input.converted ?? null,
      service: input.service?.trim() || null,
      amountCollected,
      market,
    },
  });
}

/**
 * Fill amountCollected from a verified payment fact only.
 * Guessed ad revenue is ignored. Newer verified amounts are not overwritten.
 */
export async function applyVerifiedCollectedAmount(
  input: ApplyVerifiedAmountInput,
): Promise<LeadAttribution> {
  const row = await prisma.leadAttribution.findUnique({
    where: { id: input.attributionId },
  });
  if (!row) {
    throw new LeadAttributionError("PAYMENT_FACT_REQUIRED", "LeadAttribution row not found.");
  }

  const tx = await prisma.paymentTransaction.findUnique({
    where: { id: input.paymentTransactionId },
  });
  if (!tx || tx.status !== "SUCCEEDED" || tx.clientId !== row.clientId) {
    throw new LeadAttributionError(
      "PAYMENT_FACT_MISMATCH",
      "amount_collected requires a SUCCEEDED payment transaction on the same master client.",
    );
  }

  if (
    row.amountCollected != null &&
    row.updatedAt.getTime() > tx.updatedAt.getTime()
  ) {
    throw new LeadAttributionError(
      "REFUSE_OVERWRITE_NEWER_PAYMENT",
      "Refusing to overwrite newer verified payment data with a guessed or older ad-revenue amount.",
    );
  }

  void input.guessedAdRevenueCents;
  return prisma.leadAttribution.update({
    where: { id: row.id },
    data: { amountCollected: tx.amountCents },
  });
}

export async function getRevenueByContent(): Promise<{
  status: RevenueByContentStatus;
  reason: string;
  rows: Array<{
    clientId: string;
    source: AttributionSource;
    campaignId: string | null;
    contentId: string | null;
    adId: string | null;
    cta: string | null;
    amountCollected: number | null;
  }>;
}> {
  const attributions = await prisma.leadAttribution.findMany({
    select: {
      clientId: true,
      source: true,
      campaignId: true,
      contentId: true,
      adId: true,
      cta: true,
      amountCollected: true,
    },
  });

  const qualified = attributions.filter(
    (row) => revenueByContentStatus(row) === "AVAILABLE",
  );

  if (qualified.length === 0) {
    return {
      status: DATA_UNAVAILABLE,
      reason:
        "Revenue-by-content is DATA UNAVAILABLE until intake stamps campaign/content/ad/CTA and a LeadAttribution row on the master has a verified X5 / Jobber / Authorize.Net amount_collected.",
      rows: [],
    };
  }

  return {
    status: "AVAILABLE",
    reason: "Stamped LeadAttribution rows with verified payment facts.",
    rows: qualified,
  };
}
