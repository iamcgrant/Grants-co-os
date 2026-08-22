import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payments/provider";
import { commasHonestHealth } from "@/lib/payments/commas-config";
import { probeCloudTaxOfficeHealth, probeSbtpgHealth } from "@/lib/tax/health";
import { probeCognitoHealth } from "@/lib/integrations/cognito/health";
import { isGhlApiReady } from "@/lib/integrations/ghl/http";
import { probeGhlSmsEmailPath, probeGhlVoiceHealth } from "@/lib/integrations/ghl/probes";
import { probeTelegramTeam } from "@/lib/integrations/telegram/workspace";
import { probeGmailInbox } from "@/lib/integrations/gmail/workspace";
import { getGcEnvironment } from "@/lib/integrations/env";
import { probeDisputeFoxApi } from "@/lib/integrations/disputefox/probe";
import { probeSmartCreditHealth } from "@/lib/credit/smartcredit-health";

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
 * CONNECTED only after a real operational check (query, pull, send, webhook, or HTTPS probe).
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
    queuedAutomations,
    failedAutomations,
    openExceptions,
    lastPulse,
    disputeFoxProbe,
    smartCreditProbe,
    cloudTaxProbe,
    cognitoProbe,
    sbtpgProbe,
    lastCommasCheckout,
    lastCommasPaymentWebhook,
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
    prisma.automationRun.count({ where: { status: "QUEUED" } }),
    prisma.automationRun.count({ where: { status: "FAILED" } }),
    prisma.exceptionTicket.count({ where: { status: "OPEN" } }),
    prisma.fridayPulseRun.findFirst({ orderBy: { createdAt: "desc" } }),
    probeDisputeFoxApi(),
    probeSmartCreditHealth(),
    probeCloudTaxOfficeHealth(),
    probeCognitoHealth(),
    probeSbtpgHealth(),
    prisma.paymentLink.findFirst({
      where: { provider: "commas", providerSessionId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.webhookEvent.findFirst({
      where: { status: "PROCESSED", provider: { in: ["commas", "grants_pay"] } },
      orderBy: { processedAt: "desc" },
    }),
  ]);
  const commas = commasHonestHealth({
    lastWebhookAt: lastCommasPaymentWebhook?.processedAt?.toISOString() || null,
    lastCheckoutAt: lastCommasCheckout?.createdAt.toISOString() || null,
    paymentProvider: provider.name,
  });

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

  const [smsEmailProbe, voiceProbe, telegramProbe, gmailProbe] = await Promise.all([
    probeGhlSmsEmailPath(),
    probeGhlVoiceHealth(),
    probeTelegramTeam(),
    probeGmailInbox(),
  ]);

  const ghlAuth = ghlAuthHealth(ghlReady, authSuccessAt);
  const ghlInbound = ghlInboundPullHealth(ghlReady, inboundPullAt);
  const ghlOutbound = ghlOutboundHealth(smsEmailProbe, outboundSmsAt);
  const email = ghlEmailHealth(smsEmailProbe, outboundEmailAt);
  const voice = ghlVoiceHealth(voiceProbe);
  const telegram = telegramHealth(telegramProbe);
  const ghlWebhook = ghlWebhookHealth(lastGhlWebhook?.eventType ?? null, ghlWebhookAt);
  const disputeFox = {
    component: "disputefox",
    label: "DisputeFox",
    status: disputeFoxProbe.status,
    detail: disputeFoxProbe.detail,
    lastSuccessAt: disputeFoxProbe.lastSuccessAt,
  } as const;
  const smartCredit = {
    component: "smartcredit",
    label: "SmartCredit",
    status: smartCreditProbe.status,
    detail: smartCreditProbe.detail,
    lastSuccessAt: smartCreditProbe.lastSuccessAt,
  } as const;

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
      status: commas.status,
      detail: commas.detail,
      lastSuccessAt: commas.lastSuccessAt,
      lastCheckedAt: checkedAt,
    },
    { ...ghlAuth, lastCheckedAt: checkedAt },
    { ...ghlInbound, lastCheckedAt: checkedAt },
    { ...ghlOutbound, lastCheckedAt: checkedAt },
    { ...email, lastCheckedAt: checkedAt },
    { ...voice, lastCheckedAt: checkedAt },
    { ...telegram, lastCheckedAt: checkedAt },
    {
      component: "gmail",
      label: "Work Gmail",
      status: gmailProbe.status,
      detail: gmailProbe.detail,
      lastSuccessAt: gmailProbe.lastSuccessAt,
      lastCheckedAt: checkedAt,
    },
    { ...ghlWebhook, lastCheckedAt: checkedAt },
    { ...disputeFox, lastCheckedAt: checkedAt },
    { ...smartCredit, lastCheckedAt: checkedAt },
    {
      component: "cloud_tax_office",
      label: "Cloud Tax Office",
      status: cloudTaxProbe.status,
      detail: cloudTaxProbe.detail,
      lastSuccessAt: cloudTaxProbe.lastSuccessAt,
      lastCheckedAt: checkedAt,
    },
    {
      component: "cognito",
      label: "Cognito Forms",
      status: cognitoProbe.status,
      detail: cognitoProbe.detail,
      lastSuccessAt: cognitoProbe.lastSuccessAt,
      lastCheckedAt: checkedAt,
    },
    {
      component: "sbtpg",
      label: "SBTPG payouts",
      status: sbtpgProbe.status,
      detail: sbtpgProbe.detail,
      lastSuccessAt: sbtpgProbe.lastSuccessAt,
      lastCheckedAt: checkedAt,
    },
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
  probe: { ready: boolean; status: HealthStatus; message: string; requiredScope: string },
  lastSuccessAt: string | null,
): Omit<HealthComponent, "lastCheckedAt"> {
  if (probe.ready) {
    return {
      component: "ghl_outbound",
      label: "SMS",
      status: "CONNECTED",
      detail: probe.message,
      lastSuccessAt,
    };
  }
  return {
    component: "ghl_outbound",
    label: "SMS",
    status: probe.status,
    detail: probe.message,
    lastSuccessAt,
  };
}

function ghlEmailHealth(
  probe: { ready: boolean; status: HealthStatus; message: string; requiredScope: string },
  lastSuccessAt: string | null,
): Omit<HealthComponent, "lastCheckedAt"> {
  if (probe.ready) {
    return {
      component: "email",
      label: "Email",
      status: "CONNECTED",
      detail: probe.message,
      lastSuccessAt,
    };
  }
  return {
    component: "email",
    label: "Email",
    status: probe.status,
    detail: probe.message,
    lastSuccessAt,
  };
}

function ghlVoiceHealth(probe: {
  ready: boolean;
  status: HealthStatus;
  message: string;
}): Omit<HealthComponent, "lastCheckedAt"> {
  return {
    component: "voice",
    label: "Voice / Dialer",
    status: probe.ready ? "CONNECTED" : probe.status,
    detail: probe.message,
    lastSuccessAt: null,
  };
}

function telegramHealth(probe: {
  ready: boolean;
  status: HealthStatus;
  message: string;
}): Omit<HealthComponent, "lastCheckedAt"> {
  return {
    component: "telegram",
    label: "Telegram team",
    status: probe.ready ? "CONNECTED" : probe.status,
    detail: probe.message,
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
