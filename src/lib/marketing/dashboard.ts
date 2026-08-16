import { prisma } from "@/lib/db/prisma";

export async function getMarketingDashboard() {
  const [leads, consultations, clients, payments, sources, campaigns] =
    await Promise.all([
      prisma.conversionEvent.count({ where: { eventType: "LEAD" } }),
      prisma.conversionEvent.count({ where: { eventType: "CONSULTATION" } }),
      prisma.conversionEvent.count({ where: { eventType: "CLIENT" } }),
      prisma.conversionEvent.findMany({
        where: { eventType: "PAYMENT" },
        select: { revenueCents: true, campaignId: true },
      }),
      prisma.marketingSource.findMany({ include: { campaigns: true, leads: true } }),
      prisma.marketingCampaign.findMany({
        include: { source: true, conversionEvents: true, leads: true },
      }),
    ]);

  const revenueCents = payments.reduce((s, p) => s + p.revenueCents, 0);
  const conversionRate = leads > 0 ? clients / leads : 0;

  const revenueBySource = sources.map((source) => {
    const campaignIds = source.campaigns.map((c) => c.id);
    const rev = payments
      .filter((p) => p.campaignId && campaignIds.includes(p.campaignId))
      .reduce((s, p) => s + p.revenueCents, 0);
    return {
      source: source.name,
      platform: source.platform,
      leads: source.leads.length,
      revenueCents: rev,
    };
  });

  return {
    leads,
    qualifiedLeads: consultations,
    consultations,
    clients,
    conversionRate,
    revenueCents,
    collectedRevenueCents: revenueCents,
    revenueBySource,
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      source: c.source.name,
      contentId: c.contentId,
      costCents: c.costCents,
      leads: c.leads.length,
      revenueCents: c.conversionEvents
        .filter((e) => e.eventType === "PAYMENT")
        .reduce((s, e) => s + e.revenueCents, 0),
    })),
  };
}
