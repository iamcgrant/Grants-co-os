import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payments/provider";
import { commasPublicStatus, isCommasConfigured } from "@/lib/payments/commas-config";
import { isGhlApiReady } from "@/lib/integrations/ghl/http";
import { GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE } from "@/lib/integrations/ghl/location";
import { integrationCredentialStatus } from "@/lib/integrations/credentials";
import { getGcEnvironment } from "@/lib/integrations/env";

export type HealthStatus = "CONNECTED" | "DEGRADED" | "ACTION_REQUIRED" | "OFFLINE";

export type HealthComponent = {
  component: string;
  label: string;
  status: HealthStatus;
  detail: string;
  lastSuccessAt: string | null;
  lastCheckedAt: string;
};

function statusRank(s: HealthStatus) {
  return { CONNECTED: 0, DEGRADED: 1, ACTION_REQUIRED: 2, OFFLINE: 3 }[s];
}

/**
 * System Health — live probe of integrations, DB, queues, and jobs.
 * Never leaks secrets.
 */
export async function collectSystemHealth(): Promise<{
  overall: HealthStatus;
  environment: string;
  components: HealthComponent[];
  checkedAt: string;
}> {
  const now = new Date();
  const creds = integrationCredentialStatus();
  const commas = commasPublicStatus();
  const provider = getPaymentProvider();

  const lastWebhook = await prisma.webhookEvent.findFirst({
    where: { status: "PROCESSED" },
    orderBy: { processedAt: "desc" },
  });
  const queuedAutomations = await prisma.automationRun.count({
    where: { status: "QUEUED" },
  });
  const failedAutomations = await prisma.automationRun.count({
    where: { status: "FAILED" },
  });
  const openExceptions = await prisma.exceptionTicket.count({
    where: { status: "OPEN" },
  });
  const lastPulse = await prisma.fridayPulseRun.findFirst({
    orderBy: { createdAt: "desc" },
  });

  let databaseStatus: HealthStatus = "CONNECTED";
  let databaseDetail = "SQLite/Prisma responding";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseStatus = "OFFLINE";
    databaseDetail = "Database query failed";
  }

  const components: HealthComponent[] = [
    {
      component: "database",
      label: "Database",
      status: databaseStatus,
      detail: databaseDetail,
      lastSuccessAt: databaseStatus === "CONNECTED" ? now.toISOString() : null,
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "commas",
      label: "Commas (Grants Pay)",
      status: !isCommasConfigured()
        ? "ACTION_REQUIRED"
        : commas.environment === "production" && !commas.liveChargesEnabled
          ? "DEGRADED"
          : provider.name === "commas"
            ? "CONNECTED"
            : "DEGRADED",
      detail: !isCommasConfigured()
        ? "COMMAS_API_KEY required — sandbox first"
        : `Provider=${provider.name} · env=${commas.environment} · live=${commas.liveChargesEnabled ? "on" : "locked"}`,
      lastSuccessAt: lastWebhook?.provider === "commas" ? lastWebhook.processedAt?.toISOString() || null : null,
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "ghl",
      label: "GoHighLevel",
      status: isGhlApiReady() ? "CONNECTED" : "ACTION_REQUIRED",
      detail: isGhlApiReady()
        ? "API key present · inbound sync ready"
        : "GHL_API_KEY required for live inbound",
      lastSuccessAt: null,
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "disputefox",
      label: "DisputeFox",
      status: creds.disputeFoxApi ? "CONNECTED" : "ACTION_REQUIRED",
      detail: creds.disputeFoxApi
        ? "API key present"
        : "DISPUTEFOX_API_KEY / intake URL template optional until live attach",
      lastSuccessAt: null,
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "smartcredit",
      label: "SmartCredit",
      status: Boolean(process.env.SMARTCREDIT_SPONSOR_URL || process.env.SMARTCREDIT_SPONSOR_CODE)
        ? "CONNECTED"
        : "ACTION_REQUIRED",
      detail: process.env.SMARTCREDIT_SPONSOR_URL || process.env.SMARTCREDIT_SPONSOR_CODE
        ? "Sponsor attribution configured"
        : "SMARTCREDIT_SPONSOR_URL recommended for affiliate attribution",
      lastSuccessAt: null,
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "credit_karma",
      label: "Credit Karma",
      status: "DEGRADED",
      detail: "Client-assisted secure score entry — no unsupported scraping",
      lastSuccessAt: null,
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "email",
      label: "Email",
      status: "ACTION_REQUIRED",
      detail: isGhlApiReady()
        ? `Outbound email via POST /conversations/messages · PIT missing ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE} (live 401)`
        : `Fail-closed: GHL_API_KEY + PIT scope ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE} required`,
      lastSuccessAt: null,
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "sms",
      label: "SMS / MMS",
      status: "ACTION_REQUIRED",
      detail: isGhlApiReady()
        ? `Inbound conversations OK · outbound SMS needs PIT ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE} (live 401)`
        : `Fail-closed: GHL_API_KEY + PIT scope ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE} required`,
      lastSuccessAt: null,
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "voice",
      label: "Voice / Dialer",
      status: "ACTION_REQUIRED",
      detail: "Telephony adapter pending LeadConnector/GHL voice session support",
      lastSuccessAt: null,
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "imessage",
      label: "iMessage",
      status: "DEGRADED",
      detail: "Only when configured provider exposes iMessage — not available by default",
      lastSuccessAt: null,
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "webhooks",
      label: "Webhooks",
      status: lastWebhook ? "CONNECTED" : "DEGRADED",
      detail: lastWebhook
        ? `Last processed ${lastWebhook.eventType} via ${lastWebhook.provider}`
        : "No processed payment webhooks yet",
      lastSuccessAt: lastWebhook?.processedAt?.toISOString() || null,
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "queues",
      label: "Background queues",
      status: failedAutomations > 0 ? "ACTION_REQUIRED" : queuedAutomations > 50 ? "DEGRADED" : "CONNECTED",
      detail: `${queuedAutomations} queued · ${failedAutomations} failed · ${openExceptions} open exceptions`,
      lastSuccessAt: now.toISOString(),
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "jobs",
      label: "Scheduled jobs",
      status: "CONNECTED",
      detail: lastPulse
        ? `Last Friday Pulse ${lastPulse.createdAt.toISOString()}`
        : "Friday Credit Pulse scheduler registered · no run yet",
      lastSuccessAt: lastPulse?.createdAt.toISOString() || null,
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "backups",
      label: "Backups",
      status: process.env.DATABASE_URL?.startsWith("postgres") ? "DEGRADED" : "ACTION_REQUIRED",
      detail: process.env.DATABASE_URL?.startsWith("postgres")
        ? "Configure host-managed Postgres backups"
        : "Local SQLite — enable Postgres + backups for production",
      lastSuccessAt: null,
      lastCheckedAt: now.toISOString(),
    },
  ];

  // Persist snapshots (upsert per component)
  for (const c of components) {
    await prisma.systemHealthCheck.upsert({
      where: { component: c.component },
      create: {
        component: c.component,
        status: c.status,
        detail: c.detail,
        lastSuccessAt: c.lastSuccessAt ? new Date(c.lastSuccessAt) : null,
        lastCheckedAt: now,
        metadataJson: JSON.stringify({ label: c.label }),
      },
      update: {
        status: c.status,
        detail: c.detail,
        lastSuccessAt: c.lastSuccessAt ? new Date(c.lastSuccessAt) : undefined,
        lastCheckedAt: now,
        metadataJson: JSON.stringify({ label: c.label }),
      },
    });
  }

  const overall = components.reduce<HealthStatus>((acc, c) => {
    return statusRank(c.status) > statusRank(acc) ? c.status : acc;
  }, "CONNECTED");

  return {
    overall,
    environment: getGcEnvironment(),
    components,
    checkedAt: now.toISOString(),
  };
}
