/**
 * Acquisition command-center query stubs.
 * Missing / unstamped data = DATA UNAVAILABLE, never invented.
 */

import { startOfDay, startOfWeek } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { DATA_UNAVAILABLE, getRevenueByContent } from "@/lib/marketing/lead-attribution";
import {
  ACTIVE_PARTNER_STAGES,
  OPEN_FOLLOW_UP_STAGES,
  PARTNER_PROSPECT_STAGES,
} from "./types";

export type AcquisitionMetric<T = number> = {
  label: string;
  status: typeof DATA_UNAVAILABLE | "AVAILABLE";
  value: T | null;
  reason?: string;
};

function available<T>(label: string, value: T): AcquisitionMetric<T> {
  return { label, status: "AVAILABLE", value };
}

function unavailable<T = number>(label: string, reason: string): AcquisitionMetric<T> {
  return { label, status: DATA_UNAVAILABLE, value: null, reason };
}

export async function getAcquisitionDashboard(now = new Date()) {
  const today = startOfDay(now);
  const week = startOfWeek(now, { weekStartsOn: 1 });

  const [consumerStamped, partnerCount, referralCount] = await Promise.all([
    prisma.client.count({ where: { acquisitionStage: { not: null } } }),
    prisma.partner.count(),
    prisma.partnerReferral.count(),
  ]);

  const hasConsumerData = consumerStamped > 0;
  const hasPartnerData = partnerCount > 0;
  const noEngineReason =
    "DATA UNAVAILABLE — no acquisition-stamped Client or Partner rows. Counts are not invented.";

  const [
    newLeadsToday,
    newLeadsWeek,
    consultations,
    pendingPayments,
    newClientsToday,
    newClientsWeek,
    partnerProspects,
    activePartners,
    reactivationLeads,
    followUps,
    convertedWeek,
  ] = hasConsumerData || hasPartnerData
    ? await Promise.all([
        prisma.client.count({
          where: { acquisitionStage: { not: null }, createdAt: { gte: today } },
        }),
        prisma.client.count({
          where: { acquisitionStage: { not: null }, createdAt: { gte: week } },
        }),
        prisma.client.count({
          where: {
            OR: [
              { acquisitionStage: { in: ["CONSULTATION_BOOKED", "CONSULTATION_COMPLETED"] } },
              { leadAttributions: { some: { consultBookedAt: { not: null } } } },
            ],
          },
        }),
        prisma.client.count({ where: { acquisitionStage: "PAYMENT_PENDING" } }),
        prisma.client.count({
          where: {
            acquisitionStage: { in: ["PAID_ONBOARDING", "CONVERTED_CLIENT"] },
            updatedAt: { gte: today },
          },
        }),
        prisma.client.count({
          where: {
            acquisitionStage: { in: ["PAID_ONBOARDING", "CONVERTED_CLIENT"] },
            updatedAt: { gte: week },
          },
        }),
        prisma.partner.count({
          where: { pipelineStage: { in: [...PARTNER_PROSPECT_STAGES] } },
        }),
        prisma.partner.count({
          where: { pipelineStage: { in: [...ACTIVE_PARTNER_STAGES] } },
        }),
        prisma.client.count({ where: { acquisitionSource: "REACTIVATION_CAMPAIGN" } }),
        prisma.client.count({
          where: {
            acquisitionStage: { in: [...OPEN_FOLLOW_UP_STAGES] },
            doNotContact: false,
            unsubscribed: false,
          },
        }),
        prisma.client.count({
          where: {
            acquisitionStage: { in: ["PAID_ONBOARDING", "CONVERTED_CLIENT"] },
            updatedAt: { gte: week },
          },
        }),
      ])
    : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  const revenueByContent = await getRevenueByContent();

  const conversionRate: AcquisitionMetric<number> = !hasConsumerData
    ? unavailable("Conversion Rate", noEngineReason)
    : newLeadsWeek === 0
      ? unavailable(
          "Conversion Rate",
          "DATA UNAVAILABLE — no stamped consumer leads this week. Rate is not invented.",
        )
      : available("Conversion Rate", convertedWeek / newLeadsWeek);

  const revenueBySource: AcquisitionMetric<typeof revenueByContent.rows> =
    revenueByContent.status === DATA_UNAVAILABLE
      ? unavailable(
          "Revenue by Source",
          revenueByContent.reason ||
            "DATA UNAVAILABLE until LeadAttribution intake stamp + verified payment fact.",
        )
      : available("Revenue by Source", revenueByContent.rows);

  return {
    engines: {
      partners: "A",
      consumers: "B",
      mixed: false,
    },
    locks: {
      friday: false,
      welcome: false,
      coldSms: false,
      liveGhl: false,
    },
    metrics: {
      newLeadsToday: hasConsumerData
        ? available("New Leads Today", newLeadsToday)
        : unavailable("New Leads Today", noEngineReason),
      newLeadsWeek: hasConsumerData
        ? available("New Leads Week", newLeadsWeek)
        : unavailable("New Leads Week", noEngineReason),
      consultations: hasConsumerData
        ? available("Consultations", consultations)
        : unavailable("Consultations", noEngineReason),
      pendingPayments: hasConsumerData
        ? available("Pending Payments", pendingPayments)
        : unavailable("Pending Payments", noEngineReason),
      newClients: hasConsumerData
        ? available("New Clients", newClientsToday)
        : unavailable("New Clients", noEngineReason),
      newClientsWeek: hasConsumerData
        ? available("New Clients Week", newClientsWeek)
        : unavailable("New Clients Week", noEngineReason),
      partnerProspects: hasPartnerData
        ? available("Partner Prospects", partnerProspects)
        : unavailable("Partner Prospects", noEngineReason),
      activeReferralPartners: hasPartnerData
        ? available("Active Referral Partners", activePartners)
        : unavailable("Active Referral Partners", noEngineReason),
      partnerReferrals: hasPartnerData || referralCount > 0
        ? available("Partner Referrals", referralCount)
        : unavailable("Partner Referrals", noEngineReason),
      reactivationLeads: hasConsumerData
        ? available("Reactivation Leads", reactivationLeads)
        : unavailable("Reactivation Leads", noEngineReason),
      conversionRate,
      revenueBySource,
      leadsNeedingFollowUp: hasConsumerData
        ? available("Leads Needing Follow-Up", followUps)
        : unavailable("Leads Needing Follow-Up", noEngineReason),
    },
  };
}

export type AcquisitionDashboard = Awaited<ReturnType<typeof getAcquisitionDashboard>>;
