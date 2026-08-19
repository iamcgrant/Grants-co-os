import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

export type IngestProvider = "ghl" | "disputefox";

function expectedSecret(provider: IngestProvider): string | null {
  switch (provider) {
    case "ghl":
      return process.env.GHL_WEBHOOK_SECRET?.trim() || null;
    case "disputefox":
      return process.env.DISPUTEFOX_WEBHOOK_SECRET?.trim() || null;
    default: {
      const _never: never = provider;
      return _never;
    }
  }
}

export function webhookSecretConfigured(provider: IngestProvider): boolean {
  return Boolean(expectedSecret(provider));
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] || null;
  return raw || null;
}

/**
 * Shared-secret check. Accepts HMAC hex of the raw body or a matching bearer/secret header.
 * Fail-closed when the secret is missing.
 */
export function verifyInboundWebhook(input: {
  provider: IngestProvider;
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
}): boolean {
  const secret = expectedSecret(input.provider);
  if (!secret) return false;

  const presented =
    headerValue(input.headers, "x-webhook-signature") ||
    headerValue(input.headers, "x-ghl-signature") ||
    headerValue(input.headers, "x-disputefox-signature") ||
    headerValue(input.headers, "x-webhook-secret") ||
    headerValue(input.headers, "authorization")?.replace(/^Bearer\s+/i, "") ||
    null;
  if (!presented) return false;

  const expectedHmac = createHmac("sha256", secret).update(input.rawBody, "utf8").digest("hex");
  const a = Buffer.from(presented);
  const b = Buffer.from(expectedHmac);
  const plain = Buffer.from(secret);
  if (a.length === b.length && timingSafeEqual(a, b)) return true;
  if (a.length === plain.length && timingSafeEqual(a, plain)) return true;
  return false;
}

function eventIdFromPayload(provider: IngestProvider, payload: unknown, rawBody: string): string {
  if (payload && typeof payload === "object") {
    const rec = payload as Record<string, unknown>;
    const id =
      rec.id ||
      rec.eventId ||
      rec.webhookId ||
      rec.messageId ||
      (rec.message && typeof rec.message === "object"
        ? (rec.message as Record<string, unknown>).id
        : null);
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  const hash = createHmac("sha256", provider).update(rawBody, "utf8").digest("hex").slice(0, 32);
  return `body:${hash}`;
}

function eventTypeFromPayload(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const rec = payload as Record<string, unknown>;
    const type = rec.type || rec.eventType || rec.kind;
    if (typeof type === "string" && type.trim()) return type.trim();
  }
  return "unknown";
}

/**
 * Persist a verified inbound webhook. Idempotent on (provider, providerEventId).
 * Does not call vendor APIs and does not create Grants clients.
 */
export async function ingestVerifiedWebhook(input: {
  provider: IngestProvider;
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
}): Promise<{ accepted: boolean; duplicate: boolean; eventId: string; reason?: string }> {
  if (!verifyInboundWebhook(input)) {
    return {
      accepted: false,
      duplicate: false,
      eventId: "",
      reason: webhookSecretConfigured(input.provider)
        ? "Invalid webhook signature"
        : `Fail-closed: ${input.provider === "ghl" ? "GHL_WEBHOOK_SECRET" : "DISPUTEFOX_WEBHOOK_SECRET"} is not set`,
    };
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(input.rawBody) as unknown;
  } catch {
    parsed = { raw: true };
  }

  const providerEventId = eventIdFromPayload(input.provider, parsed, input.rawBody);
  const eventType = eventTypeFromPayload(parsed);

  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_providerEventId: { provider: input.provider, providerEventId } },
  });
  if (existing?.status === "PROCESSED") {
    return { accepted: true, duplicate: true, eventId: existing.id };
  }

  const event = existing
    ? await prisma.webhookEvent.update({
        where: { id: existing.id },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          eventType,
          payloadJson: input.rawBody.slice(0, 16_000),
          errorMessage: null,
        },
      })
    : await prisma.webhookEvent.create({
        data: {
          provider: input.provider,
          providerEventId,
          eventType,
          payloadJson: input.rawBody.slice(0, 16_000),
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });

  return { accepted: true, duplicate: Boolean(existing), eventId: event.id };
}
