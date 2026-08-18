import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payments/provider";
import { commasPublicStatus, isCommasConfigured } from "@/lib/payments/commas-config";
import { isGhlApiReady } from "@/lib/integrations/ghl/http";
import { GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE } from "@/lib/integrations/ghl/location";
import { integrationCredentialStatus } from "@/lib/integrations/credentials";
import { getGcEnvironment } from "@/lib/integrations/env";
import { databaseEngineLabel, detectDatabaseEngine } from "@/lib/system/database-engine";
import { webhookSecretConfigured } from "@/lib/webhooks/ingest";
import { lastAssistedKarmaAt } from "@/lib/credit/assisted-karma";
import { lastPortalSuccessAt } from "@/lib/portals/service";

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

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/**
 * System Health — capability probes, not “secret present = Connected”.
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
  const engine = detectDatabaseEngine();
  const env = getGcEnvironment();

  const [
    lastPaymentWebhook,
    lastGhlWebhook,
    lastDfWebhook,
    lastGhlInbound,
    lastGhlOutbound,
    lastEmailOutbound,
    lastSmsOutbound,
    lastDfIdentifier,
    lastSmartcreditConn,
    lastAssistedKarma,
    lastExperianPortal,
    lastCfpbPortal,
    queuedAutomations,
    failedAutomations,
    openExceptions,
    lastPulse,
  ] = await Promise.all([
    prisma.webhookEvent.findFirst({
      where: { status: "PROCESSED", provider: { in: ["commas", "mock"] } },
      orderBy: { processedAt: "desc" },
    }),
    prisma.webhookEvent.findFirst({
      where: { status: "PROCESSED", provider: "ghl" },
      orderBy: { processedAt: "desc" },
    }),
    prisma.webhookEvent.findFirst({
      where: { status: "PROCESSED", provider: "disputefox" },
      orderBy: { processedAt: "desc" },
    }),
    prisma.message.findFirst({
      where: { provider: "GHL", deliveryStatus: "RECORDED" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.message.findFirst({
      where: { provider: "GHL", deliveryStatus: "SENT" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.message.findFirst({
      where: { provider: "GHL", deliveryStatus: "SENT", channel: "EMAIL" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.message.findFirst({
      where: { provider: "GHL", deliveryStatus: "SENT", channel: "SMS" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clientIdentifier.findFirst({
      where: { provider: "DISPUTEFOX" },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.creditConnection.findFirst({
      where: { provider: "SMARTCREDIT" },
      orderBy: { updatedAt: "desc" },
    }),
    lastAssistedKarmaAt(),
    lastPortalSuccessAt("EXPERIAN"),
    lastPortalSuccessAt("CFPB"),
    prisma.automationRun.count({ where: { status: "QUEUED" } }),
    prisma.automationRun.count({ where: { status: "FAILED" } }),
    prisma.exceptionTicket.count({ where: { status: "OPEN" } }),
    prisma.fridayPulseRun.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  let databaseStatus: HealthStatus = "CONNECTED";
  let databaseDetail = `${databaseEngineLabel(engine)} responding`;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseStatus = "OFFLINE";
    databaseDetail = `${databaseEngineLabel(engine)} query failed`;
  }
  if (databaseStatus === "CONNECTED" && engine === "sqlite" && env === "production") {
    databaseStatus = "ACTION_REQUIRED";
    databaseDetail = "Production is pointing at local SQLite — set Neon DATABASE_URL";
  } else if (databaseStatus === "CONNECTED" && engine === "sqlite") {
    databaseStatus = "DEGRADED";
    databaseDetail = "Local SQLite — fine for development, not production";
  }

  const ghlKey = isGhlApiReady();
  const ghlAuth: HealthComponent = {
    component: "ghl_auth",
    label: "GHL auth",
    status: lastGhlInbound
      ? "CONNECTED"
      : ghlKey
        ? "DEGRADED"
        : "ACTION_REQUIRED",
    detail: lastGhlInbound
      ? "Private Integration accepted an inbound pull"
      : ghlKey
        ? "GHL_API_KEY present · not proven until a successful inbound pull"
        : "GHL_API_KEY required",
    lastSuccessAt: iso(lastGhlInbound?.createdAt),
    lastCheckedAt: now.toISOString(),
  };

  const ghlInbound: HealthComponent = {
    component: "ghl_inbound",
    label: "GHL inbound",
    status: lastGhlInbound ? "CONNECTED" : ghlKey ? "DEGRADED" : "ACTION_REQUIRED",
    detail: lastGhlInbound
      ? "Conversation pull recorded onto linked masters"
      : ghlKey
        ? "Pull adapter ready · no recorded GHL messages yet (needs conversations.readonly)"
        : "Fail-closed without GHL_API_KEY",
    lastSuccessAt: iso(lastGhlInbound?.createdAt),
    lastCheckedAt: now.toISOString(),
  };

  const ghlOutbound: HealthComponent = {
    component: "ghl_outbound",
    label: "GHL outbound",
    status: lastGhlOutbound ? "CONNECTED" : "ACTION_REQUIRED",
    detail: lastGhlOutbound
      ? "At least one outbound GHL message marked SENT"
      : `PIT missing ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE} · live POST /conversations/messages 401`,
    lastSuccessAt: iso(lastGhlOutbound?.createdAt),
    lastCheckedAt: now.toISOString(),
  };

  const components: HealthComponent[] = [
    {
      component: "database",
      label: "Database",
      status: databaseStatus,
      detail: databaseDetail,
      lastSuccessAt: databaseStatus === "OFFLINE" ? null : now.toISOString(),
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
      lastSuccessAt: lastPaymentWebhook?.provider === "commas" ? iso(lastPaymentWebhook.processedAt) : null,
      lastCheckedAt: now.toISOString(),
    },
    ghlAuth,
    ghlInbound,
    ghlOutbound,
    {
      component: "email",
      label: "Email",
      status: lastEmailOutbound ? "CONNECTED" : "ACTION_REQUIRED",
      detail: lastEmailOutbound
        ? "Outbound email delivered via GHL"
        : ghlKey
          ? `Outbound email via POST /conversations/messages · PIT missing ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE} (live 401)`
          : `Fail-closed: GHL_API_KEY + PIT scope ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE} required`,
      lastSuccessAt: iso(lastEmailOutbound?.createdAt),
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "sms",
      label: "SMS / MMS",
      status: lastSmsOutbound ? "CONNECTED" : lastGhlInbound ? "DEGRADED" : "ACTION_REQUIRED",
      detail: lastSmsOutbound
        ? "Outbound SMS delivered via GHL"
        : lastGhlInbound
          ? `Inbound conversations recorded · outbound SMS needs PIT ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE}`
          : ghlKey
            ? `Inbound pull unused · outbound SMS needs PIT ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE} (live 401)`
            : `Fail-closed: GHL_API_KEY + PIT scope ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE} required`,
      lastSuccessAt: iso(lastSmsOutbound?.createdAt || lastGhlInbound?.createdAt),
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "voice",
      label: "Voice / Dialer",
      status: "ACTION_REQUIRED",
      detail:
        "LeadConnectorTelephonyAdapter · browserDialer false · phone-system/voice-ai 401 · no second phone provider",
      lastSuccessAt: null,
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "imessage",
      label: "iMessage",
      status: "DEGRADED",
      detail: "Inbound GHL iMessage maps to SMS channel only — not a launch blocker",
      lastSuccessAt: null,
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "disputefox",
      label: "DisputeFox",
      status: lastDfIdentifier ? "DEGRADED" : creds.disputeFoxApi ? "DEGRADED" : "ACTION_REQUIRED",
      detail: lastDfIdentifier
        ? "Local attach / identifier on a master · live list disabled · Zap 374413762 OFF"
        : creds.disputeFoxApi
          ? "API key present · live list disabled · not a connected workspace"
          : "No DisputeFox identifier yet · DISPUTEFOX_API_KEY optional until live attach",
      lastSuccessAt: iso(lastDfIdentifier?.updatedAt),
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "smartcredit",
      label: "SmartCredit",
      status: lastSmartcreditConn
        ? "DEGRADED"
        : creds.smartCreditSponsor
          ? "DEGRADED"
          : "ACTION_REQUIRED",
      detail: lastSmartcreditConn
        ? `Enrollment row ${lastSmartcreditConn.status} · not live bureau sync`
        : creds.smartCreditSponsor
          ? "Sponsor URL configured · no live score API"
          : "SMARTCREDIT_SPONSOR_URL recommended for affiliate attribution",
      lastSuccessAt: iso(lastSmartcreditConn?.lastSyncedAt || lastSmartcreditConn?.updatedAt),
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "credit_karma",
      label: "Credit Karma",
      status: lastAssistedKarma ? "CONNECTED" : "DEGRADED",
      detail: lastAssistedKarma
        ? "Client-assisted scores on file · no scraping"
        : "Client-assisted secure score entry only — no unsupported scraping",
      lastSuccessAt: iso(lastAssistedKarma),
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "experian_portal",
      label: "Experian portal",
      status: lastExperianPortal ? "CONNECTED" : "DEGRADED",
      detail: lastExperianPortal
        ? "Staff-recorded Experian portal result"
        : "No Experian API · new-tab workspace until a result is recorded",
      lastSuccessAt: iso(lastExperianPortal),
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "cfpb_portal",
      label: "CFPB escalations",
      status: lastCfpbPortal ? "CONNECTED" : "DEGRADED",
      detail: lastCfpbPortal
        ? "Staff-recorded CFPB complaint result"
        : "No CFPB API · new-tab complaint portal until a result is recorded",
      lastSuccessAt: iso(lastCfpbPortal),
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "webhooks_commas",
      label: "Webhooks · Commas",
      status: lastPaymentWebhook ? "CONNECTED" : "DEGRADED",
      detail: lastPaymentWebhook
        ? `Last processed ${lastPaymentWebhook.eventType}`
        : "No processed payment webhooks yet",
      lastSuccessAt: iso(lastPaymentWebhook?.processedAt),
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "webhooks_ghl",
      label: "Webhooks · GHL",
      status: lastGhlWebhook ? "CONNECTED" : webhookSecretConfigured("ghl") ? "DEGRADED" : "ACTION_REQUIRED",
      detail: lastGhlWebhook
        ? `Last processed ${lastGhlWebhook.eventType}`
        : webhookSecretConfigured("ghl")
          ? "GHL_WEBHOOK_SECRET set · no inbound events yet"
          : "No GHL webhook secret · pull remains the inbound path",
      lastSuccessAt: iso(lastGhlWebhook?.processedAt),
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "webhooks_disputefox",
      label: "Webhooks · DisputeFox",
      status: lastDfWebhook
        ? "CONNECTED"
        : webhookSecretConfigured("disputefox")
          ? "DEGRADED"
          : "ACTION_REQUIRED",
      detail: lastDfWebhook
        ? `Last processed ${lastDfWebhook.eventType}`
        : webhookSecretConfigured("disputefox")
          ? "DISPUTEFOX_WEBHOOK_SECRET set · no inbound events yet"
          : "No DisputeFox webhook secret · Zap 374413762 stays OFF",
      lastSuccessAt: iso(lastDfWebhook?.processedAt),
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
      lastSuccessAt: iso(lastPulse?.createdAt),
      lastCheckedAt: now.toISOString(),
    },
    {
      component: "backups",
      label: "Backups",
      status: engine === "postgres" ? "DEGRADED" : "ACTION_REQUIRED",
      detail:
        engine === "postgres"
          ? "Host-managed Neon backups must be confirmed in the dashboard — not code-only"
          : "Local SQLite — enable Postgres + Neon backups for production",
      lastSuccessAt: null,
      lastCheckedAt: now.toISOString(),
    },
  ];

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
    environment: env,
    components,
    checkedAt: now.toISOString(),
  };
}
