import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { addTimelineEvent } from "@/lib/clients/timeline";
import { runFridayCreditPulse } from "@/lib/credit/pulse";
import { ensureMasterOnboarding } from "@/lib/clients/onboarding-runtime";
import { issueOnboardingToken } from "@/lib/payments/payment-requests";
import { assignDefaultStaff } from "@/lib/ops/assignment";
import { sendGhlOutboundMessage } from "@/lib/integrations/ghl/outbound";
import { GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE } from "@/lib/integrations/ghl/location";

export type AutomationKind =
  | "PAYMENT_COMPLETED"
  | "PAYMENT_LINK_EMAIL"
  | "PAYMENT_LINK_SMS"
  | "INTAKE_COMPLETED"
  | "FRIDAY_CREDIT_PULSE"
  | "INVOICE_REMINDER"
  | "MISSING_DOCUMENTS_REMINDER"
  | "STAFF_PAYMENT_NOTIFY"
  | "CLIENT_PAYMENT_CONFIRM";

type QueueInput = {
  kind: AutomationKind | string;
  clientId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  idempotencyKey?: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
};

/**
 * Server-side automation engine.
 * Normal operations run without owner interruption; failures become ExceptionTickets.
 */
export async function queueAutomation(input: QueueInput) {
  if (input.idempotencyKey) {
    const existing = await prisma.automationRun.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
  }

  return prisma.automationRun.create({
    data: {
      kind: input.kind,
      status: "QUEUED",
      clientId: input.clientId || null,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      idempotencyKey: input.idempotencyKey || null,
      maxAttempts: input.maxAttempts ?? 5,
      resultJson: input.payload ? JSON.stringify(input.payload) : null,
    },
  });
}

export async function processAutomationRun(runId: string) {
  const run = await prisma.automationRun.findUnique({ where: { id: runId } });
  if (!run) return null;
  if (run.status === "SUCCEEDED" || run.status === "SKIPPED") return run;

  await prisma.automationRun.update({
    where: { id: run.id },
    data: {
      status: "RUNNING",
      attempt: { increment: 1 },
      startedAt: run.startedAt || new Date(),
    },
  });

  try {
    const payload = run.resultJson ? (JSON.parse(run.resultJson) as Record<string, unknown>) : {};
    const result = await dispatchAutomation(run.kind, {
      clientId: run.clientId,
      entityType: run.entityType,
      entityId: run.entityId,
      payload,
    });

    return prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
        resultJson: JSON.stringify({ ...payload, result }),
        errorMessage: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Automation failed";
    const attempt = run.attempt + 1;
    const exhausted = attempt >= run.maxAttempts;

    if (exhausted) {
      await prisma.exceptionTicket.create({
        data: {
          kind: `AUTOMATION_${run.kind}`,
          severity: "HIGH",
          title: `Automation failed: ${run.kind}`,
          detail: message,
          clientId: run.clientId,
          entityType: "AutomationRun",
          entityId: run.id,
        },
      });
    }

    const backoffMinutes = Math.min(60, 2 ** Math.min(attempt, 5));
    return prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: exhausted ? "FAILED" : "QUEUED",
        errorMessage: message,
        nextRetryAt: exhausted ? null : new Date(Date.now() + backoffMinutes * 60_000),
      },
    });
  }
}

async function dispatchAutomation(
  kind: string,
  ctx: {
    clientId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    payload: Record<string, unknown>;
  },
) {
  switch (kind) {
    case "PAYMENT_COMPLETED":
      return handlePaymentCompleted(ctx);
    case "PAYMENT_LINK_EMAIL":
    case "PAYMENT_LINK_SMS": {
      const channel = kind === "PAYMENT_LINK_EMAIL" ? "Email" : "SMS";
      const ghlContactId = await resolveGhlContactId(ctx.clientId);
      const body =
        typeof ctx.payload.url === "string"
          ? `Grants & Co payment link: ${ctx.payload.url}`
          : "Grants & Co payment link (see staff portal).";

      if (!ghlContactId) {
        await writeAuditLog({
          action: kind,
          entityType: ctx.entityType || "PaymentLink",
          entityId: ctx.entityId || undefined,
          metadata: {
            delivery: "ACTION_REQUIRED",
            channel,
            to: ctx.payload.to,
            note: "No linked GHL contact on master client — cannot send via LeadConnector",
            requiredScope: GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE,
          },
        });
        return { recorded: true, delivered: false, status: "ACTION_REQUIRED" };
      }

      const result = await sendGhlOutboundMessage({
        channel,
        ghlContactId,
        body,
        subject: "Grants & Co payment link",
      });

      await writeAuditLog({
        action: kind,
        entityType: ctx.entityType || "PaymentLink",
        entityId: ctx.entityId || undefined,
        metadata: {
          delivery: result.ok ? "SENT" : result.status,
          channel,
          to: ctx.payload.to,
          ghlContactId,
          providerMessageId: result.ok ? result.providerMessageId : undefined,
          reason: result.ok ? undefined : result.reason,
          requiredScope: result.ok ? undefined : result.requiredScope,
          httpStatus: result.ok ? undefined : result.httpStatus,
        },
      });

      return {
        recorded: true,
        delivered: result.ok,
        status: result.ok ? "SENT" : result.status,
      };
    }
    case "FRIDAY_CREDIT_PULSE": {
      const clients = await prisma.client.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
        take: 500,
      });
      const results = [];
      for (const c of clients) {
        results.push({ clientId: c.id, ...(await runFridayCreditPulse(c.id)) });
      }
      return { clients: results.length, results: results.slice(0, 5) };
    }
    case "CLIENT_PAYMENT_CONFIRM":
    case "STAFF_PAYMENT_NOTIFY":
      if (ctx.clientId) {
        await addTimelineEvent({
          clientId: ctx.clientId,
          eventType: kind,
          title: kind === "CLIENT_PAYMENT_CONFIRM" ? "Client payment confirmation queued" : "Staff payment notification queued",
          description: "Lifecycle automation recorded",
          idempotencyKey: `auto:${kind}:${ctx.entityId || ctx.clientId}`,
        });
      }
      return { recorded: true };
    case "INTAKE_COMPLETED":
      if (ctx.clientId) {
        await assignDefaultStaff(ctx.clientId);
      }
      return { assigned: Boolean(ctx.clientId) };
    default:
      return { skipped: true, reason: `No handler for ${kind}` };
  }
}

async function resolveGhlContactId(clientId?: string | null): Promise<string | null> {
  if (!clientId) return null;
  const ident = await prisma.clientIdentifier.findFirst({
    where: { clientId, provider: "GHL" },
    orderBy: { createdAt: "asc" },
    select: { externalId: true },
  });
  return ident?.externalId?.trim() || null;
}

async function handlePaymentCompleted(ctx: {
  clientId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload: Record<string, unknown>;
}) {
  if (!ctx.clientId) throw new Error("PAYMENT_COMPLETED requires clientId");

  await ensureMasterOnboarding(ctx.clientId);

  const invoiceId = typeof ctx.payload.invoiceId === "string" ? ctx.payload.invoiceId : null;
  const paymentId = typeof ctx.payload.transactionId === "string" ? ctx.payload.transactionId : null;
  const serviceName =
    typeof ctx.payload.serviceName === "string" ? ctx.payload.serviceName : null;

  const token = await issueOnboardingToken({
    clientId: ctx.clientId,
    invoiceId,
    paymentId,
    serviceName,
  });

  await assignDefaultStaff(ctx.clientId);

  await queueAutomation({
    kind: "STAFF_PAYMENT_NOTIFY",
    clientId: ctx.clientId,
    entityType: "PaymentTransaction",
    entityId: paymentId || undefined,
    idempotencyKey: `staff_pay_notify:${paymentId || ctx.clientId}`,
  });

  await queueAutomation({
    kind: "CLIENT_PAYMENT_CONFIRM",
    clientId: ctx.clientId,
    entityType: "PaymentTransaction",
    entityId: paymentId || undefined,
    idempotencyKey: `client_pay_confirm:${paymentId || ctx.clientId}`,
  });

  await addTimelineEvent({
    clientId: ctx.clientId,
    eventType: "ONBOARDING_TOKEN_ISSUED",
    title: "Client setup link ready",
    description: "Secure one-time onboarding token issued after payment",
    idempotencyKey: `onboarding_token:${token.setupPath}`,
    metadata: { setupPath: token.setupPath, expiresAt: token.expiresAt.toISOString() },
  });

  return { setupPath: token.setupPath, expiresAt: token.expiresAt.toISOString() };
}

export async function drainAutomationQueue(limit = 25) {
  const due = await prisma.automationRun.findMany({
    where: {
      status: "QUEUED",
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const results = [];
  for (const run of due) {
    results.push(await processAutomationRun(run.id));
  }
  return results;
}

export async function scheduleFridayCreditPulse() {
  const key = `friday_pulse:${new Date().toISOString().slice(0, 10)}`;
  return queueAutomation({
    kind: "FRIDAY_CREDIT_PULSE",
    idempotencyKey: key,
  });
}
