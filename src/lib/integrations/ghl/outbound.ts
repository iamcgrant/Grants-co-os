/**
 * GHL / LeadConnector outbound SMS + email adapter.
 *
 * Separate from the inbound-only HTTP client (`http.ts`), which must never send.
 * Fail-closed: missing key, missing write scope, or provider errors never pretend success.
 *
 * Live probe (this environment): POST /conversations/messages → 401
 *   "The token is not authorized for this scope."
 * Required PIT scope: conversations/message.write
 */

import { getGhlApiConfig } from "@/lib/integrations/credentials";
import {
  GHL_API_KEY_ENV,
  GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE,
  GHL_CONVERSATIONS_WRITE_SCOPE,
  GHL_LOCATION_ID_ENV,
} from "./location";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

export type OutboundChannel = "SMS" | "Email";

export type OutboundSendInput = {
  channel: OutboundChannel;
  /** GHL contact id (required by LeadConnector send API). */
  ghlContactId: string;
  body: string;
  subject?: string;
  html?: string;
  fromNumber?: string;
  toNumber?: string;
  emailFrom?: string;
  emailTo?: string;
};

export type OutboundSendResult =
  | {
      ok: true;
      status: "SENT";
      providerMessageId: string;
      conversationId?: string;
    }
  | {
      ok: false;
      status: "ACTION_REQUIRED";
      reason: string;
      requiredScope?: string;
      additionalScopesNeeded?: string[];
      httpStatus?: number;
      providerMessage?: string;
    };

export class GhlOutboundError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
    public requiredScope?: string,
  ) {
    super(message);
    this.name = "GhlOutboundError";
  }
}

function requireConfig() {
  const config = getGhlApiConfig();
  if (!config?.apiKey) {
    throw new GhlOutboundError(`${GHL_API_KEY_ENV} is not configured`, 503);
  }
  if (!config.locationId) {
    throw new GhlOutboundError(`${GHL_LOCATION_ID_ENV} is not configured`, 503);
  }
  return config;
}

function isScopeDenied(status: number, body: string): boolean {
  if (status !== 401 && status !== 403) return false;
  const lower = body.toLowerCase();
  return (
    lower.includes("not authorized for this scope") ||
    lower.includes("scope") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden")
  );
}

async function postConversationMessage(payload: Record<string, unknown>): Promise<{
  status: number;
  text: string;
  json: Record<string, unknown> | null;
}> {
  const { apiKey } = requireConfig();
  const res = await fetch(`${GHL_BASE}/conversations/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: GHL_VERSION,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "GrantsCoOS/1.0 (+ghl-outbound)",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = null;
    }
  }
  return { status: res.status, text, json };
}

function actionRequired(input: {
  reason: string;
  httpStatus?: number;
  providerMessage?: string;
}): OutboundSendResult {
  return {
    ok: false,
    status: "ACTION_REQUIRED",
    reason: input.reason,
    requiredScope: GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE,
    additionalScopesNeeded: [GHL_CONVERSATIONS_WRITE_SCOPE],
    httpStatus: input.httpStatus,
    providerMessage: input.providerMessage,
  };
}

/**
 * Probe whether the current PIT can call the send endpoint.
 * Uses an empty POST body so nothing is delivered — expects 401 (missing scope)
 * or 400/422 (validation = write scope present).
 */
export async function probeGhlOutboundSendScope(): Promise<{
  ready: boolean;
  status: "CONNECTED" | "ACTION_REQUIRED" | "OFFLINE";
  httpStatus?: number;
  requiredScope: string;
  message: string;
}> {
  if (!getGhlApiConfig()?.apiKey) {
    return {
      ready: false,
      status: "ACTION_REQUIRED",
      requiredScope: GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE,
      message: `Fail-closed: ${GHL_API_KEY_ENV} is not set.`,
    };
  }

  try {
    const { status, text, json } = await postConversationMessage({});
    const providerMessage =
      (typeof json?.message === "string" && json.message) || text.slice(0, 200);

    if (isScopeDenied(status, text)) {
      return {
        ready: false,
        status: "ACTION_REQUIRED",
        httpStatus: status,
        requiredScope: GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE,
        message:
          `Fail-closed: PIT missing ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE}. ` +
          `Provider: ${providerMessage}`,
      };
    }

    // 400/422 = endpoint reachable with write scope; body validation failed (expected for {}).
    if (status === 400 || status === 422 || status === 200 || status === 201) {
      return {
        ready: true,
        status: "CONNECTED",
        httpStatus: status,
        requiredScope: GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE,
        message: "Outbound send scope present on PIT.",
      };
    }

    return {
      ready: false,
      status: "ACTION_REQUIRED",
      httpStatus: status,
      requiredScope: GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE,
      message: `Outbound probe unexpected HTTP ${status}: ${providerMessage}`,
    };
  } catch (err) {
    return {
      ready: false,
      status: "OFFLINE",
      requiredScope: GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE,
      message: err instanceof Error ? err.message : "Outbound probe failed",
    };
  }
}

/**
 * Send SMS or Email via LeadConnector Conversations API.
 * Never invents delivery success on scope/auth failure.
 */
export async function sendGhlOutboundMessage(input: OutboundSendInput): Promise<OutboundSendResult> {
  const contactId = input.ghlContactId?.trim();
  if (!contactId) {
    return actionRequired({ reason: "ghlContactId is required for LeadConnector send" });
  }
  if (!getGhlApiConfig()?.apiKey) {
    return actionRequired({
      reason: `Fail-closed: ${GHL_API_KEY_ENV} is not set. Add PIT with ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE}.`,
    });
  }

  const payload: Record<string, unknown> = {
    type: input.channel,
    contactId,
  };

  if (input.channel === "SMS") {
    payload.message = input.body;
    if (input.fromNumber) payload.fromNumber = input.fromNumber;
    if (input.toNumber) payload.toNumber = input.toNumber;
  } else {
    payload.subject = input.subject?.trim() || "Message from Grants & Co";
    payload.html = input.html?.trim() || `<p>${escapeHtml(input.body)}</p>`;
    payload.message = input.body;
    if (input.emailFrom) payload.emailFrom = input.emailFrom;
    if (input.emailTo) payload.emailTo = input.emailTo;
  }

  try {
    const { status, text, json } = await postConversationMessage(payload);
    const providerMessage =
      (typeof json?.message === "string" && json.message) || text.slice(0, 300);

    if (isScopeDenied(status, text)) {
      return actionRequired({
        reason:
          `Fail-closed: PIT cannot send ${input.channel}. Required scope: ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE}.`,
        httpStatus: status,
        providerMessage,
      });
    }

    if (status < 200 || status >= 300) {
      return actionRequired({
        reason: `LeadConnector send failed (HTTP ${status})`,
        httpStatus: status,
        providerMessage,
      });
    }

    const messageId = extractProviderMessageId(json);
    if (!messageId) {
      return actionRequired({
        reason: "LeadConnector returned success without a message id — treating as ACTION_REQUIRED",
        httpStatus: status,
        providerMessage,
      });
    }

    return {
      ok: true,
      status: "SENT",
      providerMessageId: messageId,
      conversationId:
        typeof json?.conversationId === "string" ? json.conversationId : undefined,
    };
  } catch (err) {
    return actionRequired({
      reason: err instanceof Error ? err.message : "Outbound send failed",
    });
  }
}

function extractProviderMessageId(json: Record<string, unknown> | null): string | null {
  if (!json) return null;
  const messageId = json.messageId ?? json.id;
  if (typeof messageId === "string" && messageId.trim()) return messageId.trim();
  const nested = json.message;
  if (nested && typeof nested === "object") {
    const id = (nested as Record<string, unknown>).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function getGhlOutboundAdapter() {
  return {
    name: "leadconnector" as const,
    requiredScope: GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE,
    additionalScopesNeeded: [GHL_CONVERSATIONS_WRITE_SCOPE],
    send: sendGhlOutboundMessage,
    probe: probeGhlOutboundSendScope,
  };
}
