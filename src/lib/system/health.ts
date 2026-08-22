import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payments/provider";
import { commasPublicStatus, isCommasConfigured } from "@/lib/payments/commas-config";
import { isGhlApiReady } from "@/lib/integrations/ghl/http";
import { GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE } from "@/lib/integrations/ghl/location";
import { integrationCredentialStatus } from "@/lib/integrations/credentials";
import { getGcEnvironment } from "@/lib/integrations/env";

export type HealthStatus = "CONNECTED" | "DEGRADED" | "ACTION_REQUIRED" | "OFFLINE";
export type DatabaseEngine = "Postgres" | "SQLite";

export type HealthComponent = {
  component: string;
  label: string;
  status: HealthStatus;
  detail: string;
  lastSuccessAt: string | null;
  lastCheckedAt: string;
};

/** iMessage is modular and must not drag overall / launch status. */
const NON_LAUNCH_COMPONENTS = new Set(["imessage"]);

const GHL_WEBHOOK_PROVIDERS = ["ghl", "gohighlevel", "leadconnector", "GHL"] as const;
const GHL_INBOUND_SYNC_STATUSES = ["IMPORTED", "UPDATED", "LINKED"] as const;
const DF_SUCCESS_SYNC_STATUSES = ["UPDATED", "LINKED"] as const;

export function resolveDatabaseEngine(url = process.env.DATABASE_URL): DatabaseEngine {
  const value = url?.trim() ?? "";
  if (value.startsWith("postgres://") || value.startsWith("postgresql://")) {
    return "Postgres";
  }
  return "SQLite";
}

export function databaseRespondingDetail(engine: DatabaseEngine): string {
  switch (engine) {
    case "Postgres":
      return "Postgres/Prisma responding";
    case "SQLite":
      return "SQLite/Prisma responding";
    default: {
      const _exhaustive: never = engine;
      return _exhaustive;
    }
  }
}

function statusRank(s: HealthStatus) {
  return { CONNECTED: 0, DEGRADED: 1, ACTION_REQUIRED: 2, OFFLINE: 3 }[s];
}

function latestIso(...dates: Array<Date | string | null | undefined>): string | null {
  let latest = 0;
  for (const date of dates) {
    if (!date) continue;
    const ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
    if (Number.isFinite(ms) && ms > latest) latest = ms;
  }
  return latest > 0 ? new Date(latest).toISOString() : null;
}

function isoOrNull(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

/**
 * System Health — live probe of integrations, DB, queues, and jobs.
 * CONNECTED only after a real operational check (query, pull, send, or webhook row).
 * Never leaks secrets. Never invents lastSuccessAt.
 */
export async function collectSystemHealth(): Promise<{
  overall: HealthStatus;
  environment: string;
  components: HealthComponent[];
  checkedAt: string;
}> {
  const now = new Date();
  const checkedAt = now.toISOString();
  const creds = integrationCredentialStatus();
  const commas = commasPublicStatus();
  const provider = getPaymentProvider();
  const ghlReady = isGhlApiReady();
  const engine = resolveDatabaseEngine();

  const [
    lastPaymentWebhook,
    lastGhlWebhook,
    lastGhlInboundMessage,
    lastGhlOutboundSms,
    lastGhlOutboundEmail,
    lastGhlInboundSync,
    lastGhlLiveIdentifier,
    lastDfIdentifier,
    lastDfSuccessSync,
    queuedAutomations,
    failedAutomations,
    openExceptions,
    lastPulse,
  ] = await Promise.all([
    prisma.webhookEvent.findFirst({
      where: { status: "PROCESSED" },
      orderBy: { processedAt: "desc" },
    }),
    prisma.webhookEvent.findFirst({
      where: { status: "PROCESSED", provider: { in: [...GHL_WEBHOOK_PROVIDERS] } },
      orderBy: { processedAt: "desc" },
    }),
    prisma.message.findFirst({
      where: { provider: "GHL", deliveryStatus: "RECORDED" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.message.findFirst({
      where: { provider: "GHL", deliveryStatus: "SENT", channel: "SMS" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.message.findFirst({
      where: { provider: "GHL", deliveryStatus: "SENT", channel: "EMAIL" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.integrationSyncEvent.findFirst({
      where: {
        direction: "inbound",
        status: { in: [...GHL_INBOUND_SYNC_STATUSES] },
        connection: { provider: "gohighlevel" },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clientIdentifier.findFirst({
      where: { provider: "GHL", metadataJson: { contains: '"source":"ghl_api"' } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.clientIdentifier.findFirst({
      where: { provider: "DISPUTEFOX" },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.integrationSyncEvent.findFirst({
      where: {
        direction: "inbound",
        status: { in: [...DF_SUCCESS_SYNC_STATUSES] },
        connection: { provider: "disputefox" },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.automationRun.count({ where: { status: "QUEUED" } }),
    prisma.automationRun.count({ where: { status: "FAILED" } }),
    prisma.exceptionTicket.count({ where: { status: "OPEN" } }),
    prisma.fridayPulseRun.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  let databaseStatus: HealthStatus = "CONNECTED";
  let databaseDetail = databaseRespondingDetail(engine);
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseStatus = "OFFLINE";
    databaseDetail = "Database query failed";
  }

  const inboundPullAt = latestIso(lastGhlInboundMessage?.createdAt, lastGhlInboundSync?.createdAt);
  const authSuccessAt = latestIso(
    inboundPullAt,
    lastGhlLiveIdentifier?.updatedAt,
    lastGhlOutboundSms?.createdAt,
    lastGhlOutboundEmail?.createdAt,
  );
  const outboundSmsAt = isoOrNull(lastGhlOutboundSms?.createdAt);
  const outboundEmailAt = isoOrNull(lastGhlOutboundEmail?.createdAt);
  const ghlWebhookAt = isoOrNull(lastGhlWebhook?.processedAt);
  const dfSuccessAt = latestIso(lastDfIdentifier?.updatedAt, lastDfSuccessSync?.createdAt);

  const ghlAuth = ghlAuthHealth(ghlReady, authSuccessAt);
  const ghlInbound = ghlInboundPullHealth(ghlReady, inboundPullAt);
  const ghlOutbound = ghlOutboundHealth(ghlReady, outboundSmsAt);
  const email = ghlEmailHealth(ghlReady, outboundEmailAt);
  const ghlWebhook = ghlWebhookHealth(lastGhlWebhook?.eventType ?? null, ghlWebhookAt);
  const disputeFox = disputeFoxHealth(creds.disputeFoxApi, dfSuccessAt);
  const smartCredit = smartCreditHealth(
    Boolean(process.env.SMARTCREDIT_SPONSOR_URL?.trim() || process.env.SMARTCREDIT_SPONSOR_CODE?.trim()),
  );

  const components: HealthComponent[] = [
    {
      component: "database",
      label: "Database",
      status: databaseStatus,
      detail: databaseDetail,
      lastSuccessAt: databaseStatus === "CONNECTED" ? checkedAt : null,
      lastCheckedAt: checkedAt,
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
      lastSuccessAt:
        lastPaymentWebhook?.provider === "commas"
          ? lastPaymentWebhook.processedAt?.toISOString() || null
          : null,
      lastCheckedAt: checkedAt,
    },
    { ...ghlAuth, lastCheckedAt: checkedAt },
    { ...ghlInbound, lastCheckedAt: checkedAt },
    { ...ghlOutbound, lastCheckedAt: checkedAt },
    { ...email, lastCheckedAt: checkedAt },
    {
      component: "voice",
      label: "Voice / Dialer",
      status: "ACTION_REQUIRED",
      detail: "Telephony adapter pending LeadConnector/GHL voice session support",
      lastSuccessAt: null,
      lastCheckedAt: checkedAt,
    },
    { ...ghlWebhook, lastCheckedAt: checkedAt },
    { ...disputeFox, lastCheckedAt: checkedAt },
    { ...smartCredit, lastCheckedAt: checkedAt },
    {
      component: "credit_karma",
      label: "Credit Karma",
      status: "DEGRADED",
      detail: "Client-assisted secure score entry — no unsupported scraping",
      lastSuccessAt: null,
      lastCheckedAt: checkedAt,
    },
    {
      component: "imessage",
      label: "iMessage",
      status: "DEGRADED",
      detail: "Only when configured provider exposes iMessage — not available by default",
      lastSuccessAt: null,
      lastCheckedAt: checkedAt,
    },
    {
      component: "webhooks",
      label: "Webhooks",
      status: lastPaymentWebhook ? "CONNECTED" : "DEGRADED",
      detail: lastPaymentWebhook
        ? `Last processed ${lastPaymentWebhook.eventType} via ${lastPaymentWebhook.provider}`
        : "No processed payment webhooks yet",
      lastSuccessAt: lastPaymentWebhook?.processedAt?.toISOString() || null,
      lastCheckedAt: checkedAt,
    },
    {
      component: "queues",
      label: "Background queues",
      status: failedAutomations > 0 ? "ACTION_REQUIRED" : queuedAutomations > 50 ? "DEGRADED" : "CONNECTED",
      detail: `${queuedAutomations} queued · ${failedAutomations} failed · ${openExceptions} open exceptions`,
      lastSuccessAt: checkedAt,
      lastCheckedAt: checkedAt,
    },
    {
      component: "jobs",
      label: "Scheduled jobs",
      status: "CONNECTED",
      detail: lastPulse
        ? `Last Friday Pulse ${lastPulse.createdAt.toISOString()}`
        : "Friday Credit Pulse scheduler registered · no run yet",
      lastSuccessAt: lastPulse?.createdAt.toISOString() || null,
      lastCheckedAt: checkedAt,
    },
    {
      component: "backups",
      label: "Backups",
      status: engine === "Postgres" ? "DEGRADED" : "ACTION_REQUIRED",
      detail:
        engine === "Postgres"
          ? "Configure host-managed Postgres backups"
          : "Local SQLite — enable Postgres + backups for production",
      lastSuccessAt: null,
      lastCheckedAt: checkedAt,
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
        lastSuccessAt: c.lastSuccessAt ? new Date(c.lastSuccessAt) : null,
        lastCheckedAt: now,
        metadataJson: JSON.stringify({ label: c.label }),
      },
    });
  }

  const overall = components.reduce<HealthStatus>((acc, c) => {
    if (NON_LAUNCH_COMPONENTS.has(c.component)) return acc;
    return statusRank(c.status) > statusRank(acc) ? c.status : acc;
  }, "CONNECTED");

  return {
    overall,
    environment: getGcEnvironment(),
    components,
    checkedAt,
  };
}

function ghlAuthHealth(
  configured: boolean,
  lastSuccessAt: string | null,
): Omit<HealthComponent, "lastCheckedAt"> {
  if (lastSuccessAt) {
    return {
      component: "ghl_auth",
      label: "GHL auth",
      status: "CONNECTED",
      detail: "Authenticated GHL operation recorded (pull, live identifier, or send)",
      lastSuccessAt,
    };
  }
  if (configured) {
    return {
      component: "ghl_auth",
      label: "GHL auth",
      status: "DEGRADED",
      detail: "API key present · no successful authenticated GHL operation recorded",
      lastSuccessAt: null,
    };
  }
  return {
    component: "ghl_auth",
    label: "GHL auth",
    status: "ACTION_REQUIRED",
    detail: "GHL_API_KEY required for live inbound",
    lastSuccessAt: null,
  };
}

function ghlInboundPullHealth(
  configured: boolean,
  lastSuccessAt: string | null,
): Omit<HealthComponent, "lastCheckedAt"> {
  if (lastSuccessAt) {
    return {
      component: "ghl_inbound_pull",
      label: "GHL inbound pull",
      status: "CONNECTED",
      detail: "Inbound GHL conversations pulled into OS inbox",
      lastSuccessAt,
    };
  }
  if (configured) {
    return {
      component: "ghl_inbound_pull",
      label: "GHL inbound pull",
      status: "DEGRADED",
      detail: "API key present · no inbound GHL messages pulled yet",
      lastSuccessAt: null,
    };
  }
  return {
    component: "ghl_inbound_pull",
    label: "GHL inbound pull",
    status: "ACTION_REQUIRED",
    detail: "GHL_API_KEY required to pull conversations",
    lastSuccessAt: null,
  };
}

function ghlOutboundHealth(
  configured: boolean,
  lastSuccessAt: string | null,
): Omit<HealthComponent, "lastCheckedAt"> {
  if (lastSuccessAt) {
    return {
      component: "ghl_outbound",
      label: "GHL outbound",
      status: "CONNECTED",
      detail: "Outbound SMS delivered via POST /conversations/messages",
      lastSuccessAt,
    };
  }
  return {
    component: "ghl_outbound",
    label: "GHL outbound",
    status: "ACTION_REQUIRED",
    detail: configured
      ? `No successful outbound SMS · PIT missing ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE} (live 401)`
      : `Fail-closed: GHL_API_KEY + PIT scope ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE} required`,
    lastSuccessAt: null,
  };
}

function ghlEmailHealth(
  configured: boolean,
  lastSuccessAt: string | null,
): Omit<HealthComponent, "lastCheckedAt"> {
  if (lastSuccessAt) {
    return {
      component: "email",
      label: "Email",
      status: "CONNECTED",
      detail: "Outbound email delivered via POST /conversations/messages",
      lastSuccessAt,
    };
  }
  return {
    component: "email",
    label: "Email",
    status: "ACTION_REQUIRED",
    detail: configured
      ? `No successful outbound email · PIT missing ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE} (live 401)`
      : `Fail-closed: GHL_API_KEY + PIT scope ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE} required`,
    lastSuccessAt: null,
  };
}

function ghlWebhookHealth(
  eventType: string | null,
  lastSuccessAt: string | null,
): Omit<HealthComponent, "lastCheckedAt"> {
  if (lastSuccessAt) {
    return {
      component: "ghl_webhook",
      label: "GHL webhook",
      status: "CONNECTED",
      detail: eventType
        ? `Last processed GHL webhook ${eventType}`
        : "Processed GHL webhook recorded",
      lastSuccessAt,
    };
  }
  return {
    component: "ghl_webhook",
    label: "GHL webhook",
    status: "ACTION_REQUIRED",
    detail: "No processed GHL webhook — inbound is pull-only",
    lastSuccessAt: null,
  };
}

function disputeFoxHealth(
  apiKeyPresent: boolean,
  lastSuccessAt: string | null,
): Omit<HealthComponent, "lastCheckedAt"> {
  if (lastSuccessAt) {
    return {
      component: "disputefox",
      label: "DisputeFox",
      status: "CONNECTED",
      detail: "Inbound attach recorded onto an existing master client",
      lastSuccessAt,
    };
  }
  if (apiKeyPresent) {
    return {
      component: "disputefox",
      label: "DisputeFox",
      status: "DEGRADED",
      detail: "API key present · live list disabled · no successful inbound attach recorded",
      lastSuccessAt: null,
    };
  }
  return {
    component: "disputefox",
    label: "DisputeFox",
    status: "ACTION_REQUIRED",
    detail: "DISPUTEFOX_API_KEY / intake URL template optional until live attach",
    lastSuccessAt: null,
  };
}

function smartCreditHealth(sponsorConfigured: boolean): Omit<HealthComponent, "lastCheckedAt"> {
  if (sponsorConfigured) {
    return {
      component: "smartcredit",
      label: "SmartCredit",
      status: "DEGRADED",
      detail: "Sponsor attribution configured · no live score sync",
      lastSuccessAt: null,
    };
  }
  return {
    component: "smartcredit",
    label: "SmartCredit",
    status: "ACTION_REQUIRED",
    detail: "SMARTCREDIT_SPONSOR_URL recommended for affiliate attribution · no live score sync",
    lastSuccessAt: null,
  };
}
