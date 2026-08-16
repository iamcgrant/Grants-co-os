/**
 * Acquisition command-center query stubs.
 * Missing / unstamped data = DATA UNAVAILABLE, never invented.
 */

import { startOfDay, startOfWeek } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import {
  DATA_UNAVAILABLE,
  getRevenueByContent,
  hasCompleteIntakeStamp,
} from "@/lib/marketing/lead-attribution";
import {
  DEFAULT_PROSPECTING_MARKETS,
  marketLabel,
  type AcquisitionMarketValue,
} from "./markets";
import {
  ACTIVE_PARTNER_STAGES,
  CONVERTED_CONSUMER_STAGES,
  OPEN_FOLLOW_UP_STAGES,
  PARTNER_MEETING_STAGES,
  PARTNER_PROSPECT_STAGES,
  PARTNER_REPLIED_STAGES,
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

export type MarketMetricRow = {
  market: AcquisitionMarketValue;
  label: string;
  prospectsFound: AcquisitionMetric;
  replies: AcquisitionMetric;
  meetings: AcquisitionMetric;
  referrals: AcquisitionMetric;
  clientsConverted: AcquisitionMetric;
  revenue: AcquisitionMetric;
};

const UNSTAMPED_MARKET_REASON =
  "DATA UNAVAILABLE — no Partner, PartnerReferral, or LeadAttribution row stamped with this market. Counts are not invented.";
const UNSTAMPED_REVENUE_REASON =
  "DATA UNAVAILABLE until a LeadAttribution row stamped with this market has a complete intake stamp and a verified payment fact.";

async function getMetricsByMarket(): Promise<{
  status: typeof DATA_UNAVAILABLE | "AVAILABLE";
  reason?: string;
  defaultStartSet: readonly AcquisitionMarketValue[];
  rows: MarketMetricRow[];
}> {
  const [partners, referrals, attributions, convertedClients] = await Promise.all([
    prisma.partner.findMany({
      select: { id: true, market: true, pipelineStage: true },
    }),
    prisma.partnerReferral.findMany({
      select: { id: true, market: true, clientId: true },
    }),
    prisma.leadAttribution.findMany({
      select: {
        market: true,
        campaignId: true,
        contentId: true,
        adId: true,
        cta: true,
        amountCollected: true,
      },
    }),
    prisma.client.findMany({
      where: {
        acquisitionMarket: { not: null },
        acquisitionStage: { in: [...CONVERTED_CONSUMER_STAGES] },
      },
      select: { id: true, acquisitionMarket: true },
    }),
  ]);

  const markets = new Set<AcquisitionMarketValue>();
  for (const row of partners) markets.add(row.market as AcquisitionMarketValue);
  for (const row of referrals) markets.add(row.market as AcquisitionMarketValue);
  for (const row of attributions) {
    if (row.market) markets.add(row.market as AcquisitionMarketValue);
  }
  for (const row of convertedClients) {
    if (row.acquisitionMarket) markets.add(row.acquisitionMarket as AcquisitionMarketValue);
  }

  if (markets.size === 0) {
    return {
      status: DATA_UNAVAILABLE,
      reason:
        "DATA UNAVAILABLE — no market-stamped Partner, PartnerReferral, or LeadAttribution rows. Per-market counts are not invented.",
      defaultStartSet: DEFAULT_PROSPECTING_MARKETS,
      rows: [],
    };
  }

  const rows: MarketMetricRow[] = [...markets]
    .sort((a, b) => marketLabel(a).localeCompare(marketLabel(b)))
    .map((market) => {
      const marketPartners = partners.filter((row) => row.market === market);
      const marketReferrals = referrals.filter((row) => row.market === market);
      const marketConverted = convertedClients.filter((row) => row.acquisitionMarket === market);
      const marketRevenue = attributions.filter(
        (row) =>
          row.market === market &&
          hasCompleteIntakeStamp(row) &&
          row.amountCollected != null,
      );

      const hasPartnerStamp = marketPartners.length > 0;
      const hasReferralStamp = marketReferrals.length > 0;
      const hasConvertedStamp = marketConverted.length > 0;
      const hasRevenueStamp = marketRevenue.length > 0;

      return {
        market,
        label: marketLabel(market),
        prospectsFound: hasPartnerStamp
          ? available(
              "Prospects Found",
              marketPartners.filter((row) =>
                (PARTNER_PROSPECT_STAGES as readonly string[]).includes(row.pipelineStage),
              ).length,
            )
          : unavailable("Prospects Found", UNSTAMPED_MARKET_REASON),
        replies: hasPartnerStamp
          ? available(
              "Replies",
              marketPartners.filter((row) =>
                (PARTNER_REPLIED_STAGES as readonly string[]).includes(row.pipelineStage),
              ).length,
            )
          : unavailable("Replies", UNSTAMPED_MARKET_REASON),
        meetings: hasPartnerStamp
          ? available(
              "Meetings",
              marketPartners.filter((row) =>
                (PARTNER_MEETING_STAGES as readonly string[]).includes(row.pipelineStage),
              ).length,
            )
          : unavailable("Meetings", UNSTAMPED_MARKET_REASON),
        referrals: hasReferralStamp
          ? available("Referrals", marketReferrals.length)
          : unavailable("Referrals", UNSTAMPED_MARKET_REASON),
        clientsConverted: hasConvertedStamp || hasReferralStamp
          ? available("Clients Converted", hasConvertedStamp ? marketConverted.length : marketReferrals.length)
          : unavailable("Clients Converted", UNSTAMPED_MARKET_REASON),
        revenue: hasRevenueStamp
          ? available(
              "Revenue",
              marketRevenue.reduce((sum, row) => sum + (row.amountCollected ?? 0), 0),
            )
          : unavailable("Revenue", UNSTAMPED_REVENUE_REASON),
      };
    });

  return {
    status: "AVAILABLE",
    defaultStartSet: DEFAULT_PROSPECTING_MARKETS,
    rows,
  };
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

  const [revenueByContent, byMarket] = await Promise.all([
    getRevenueByContent(),
    getMetricsByMarket(),
  ]);

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
    byMarket,
  };
}

export type AcquisitionDashboard = Awaited<ReturnType<typeof getAcquisitionDashboard>>;
