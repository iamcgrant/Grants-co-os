/**
 * GHL / LeadConnector voice — existing location numbers only.
 * No Twilio, Telnyx, or number purchase. Fail closed unless a real probe succeeds.
 */

import { getGhlApiConfig } from "@/lib/integrations/credentials";
import {
  GHL_API_KEY_ENV,
  GHL_LOCATION_ID_ENV,
  GHL_PHONE_SYSTEM_READONLY_SCOPE,
  GHL_VOICE_SESSION_SCOPE,
} from "./location";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

export type GhlPhoneNumber = {
  id: string;
  phone: string;
  label?: string;
};

export type VoiceProbeResult = {
  ready: boolean;
  status: "CONNECTED" | "ACTION_REQUIRED" | "OFFLINE";
  httpStatus?: number;
  requiredScope: string;
  additionalScopesNeeded: string[];
  requiredSecrets?: string[];
  numbers: GhlPhoneNumber[];
  sessionReady: boolean;
  message: string;
};

export type VoiceCallResult =
  | { ok: true; sessionId: string; fromNumber: string; toNumber: string }
  | {
      ok: false;
      reason: string;
      requiredScope?: string;
      additionalScopesNeeded?: string[];
      httpStatus?: number;
    };

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

async function ghlVoiceFetch(path: string, init: RequestInit = {}) {
  const config = getGhlApiConfig();
  if (!config?.apiKey) {
    throw new Error(`${GHL_API_KEY_ENV} is not configured`);
  }
  const res = await fetch(`${GHL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Version: GHL_VERSION,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "GrantsCoOS/1.0 (+ghl-voice)",
      ...(init.headers || {}),
    },
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

function normalizeNumbers(json: Record<string, unknown> | null): GhlPhoneNumber[] {
  if (!json) return [];
  const raw = json.numbers ?? json.phoneNumbers ?? json.data;
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { numbers?: unknown[] }).numbers)
      ? ((raw as { numbers: unknown[] }).numbers)
      : [];
  const numbers: GhlPhoneNumber[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const phone = String(row.phone ?? row.number ?? row.phoneNumber ?? "").trim();
    const id = String(row.id ?? row.phoneNumberId ?? phone).trim();
    if (!phone) continue;
    numbers.push({
      id,
      phone,
      label: typeof row.name === "string" ? row.name : typeof row.label === "string" ? row.label : undefined,
    });
  }
  return numbers;
}

/**
 * Honest voice probe: numbers list + a no-op session/call path.
 * CONNECTED only when both succeed. A key alone is never green.
 */
export async function probeGhlVoicePath(): Promise<VoiceProbeResult> {
  const config = getGhlApiConfig();
  if (!config?.apiKey) {
    return {
      ready: false,
      status: "ACTION_REQUIRED",
      requiredScope: GHL_PHONE_SYSTEM_READONLY_SCOPE,
      additionalScopesNeeded: [GHL_VOICE_SESSION_SCOPE],
      requiredSecrets: [GHL_API_KEY_ENV],
      numbers: [],
      sessionReady: false,
      message: `Fail-closed: ${GHL_API_KEY_ENV} is not set. Voice uses existing GHL numbers only.`,
    };
  }
  if (!config.locationId) {
    return {
      ready: false,
      status: "ACTION_REQUIRED",
      requiredScope: GHL_PHONE_SYSTEM_READONLY_SCOPE,
      additionalScopesNeeded: [GHL_VOICE_SESSION_SCOPE],
      requiredSecrets: [GHL_LOCATION_ID_ENV],
      numbers: [],
      sessionReady: false,
      message: `Fail-closed: ${GHL_LOCATION_ID_ENV} is not set.`,
    };
  }

  try {
    const numbersRes = await ghlVoiceFetch(
      `/phone-system/numbers?locationId=${encodeURIComponent(config.locationId)}`,
    );
    const providerMessage =
      (typeof numbersRes.json?.message === "string" && numbersRes.json.message) ||
      numbersRes.text.slice(0, 200);

    if (isScopeDenied(numbersRes.status, numbersRes.text)) {
      return {
        ready: false,
        status: "ACTION_REQUIRED",
        httpStatus: numbersRes.status,
        requiredScope: GHL_PHONE_SYSTEM_READONLY_SCOPE,
        additionalScopesNeeded: [GHL_VOICE_SESSION_SCOPE],
        numbers: [],
        sessionReady: false,
        message:
          `Fail-closed: PIT missing ${GHL_PHONE_SYSTEM_READONLY_SCOPE} (GET /phone-system/numbers). ` +
          `Provider: ${providerMessage}`,
      };
    }

    if (numbersRes.status < 200 || numbersRes.status >= 300) {
      return {
        ready: false,
        status: "ACTION_REQUIRED",
        httpStatus: numbersRes.status,
        requiredScope: GHL_PHONE_SYSTEM_READONLY_SCOPE,
        additionalScopesNeeded: [GHL_VOICE_SESSION_SCOPE],
        numbers: [],
        sessionReady: false,
        message: `Voice number probe HTTP ${numbersRes.status}: ${providerMessage}`,
      };
    }

    const numbers = normalizeNumbers(numbersRes.json);
    if (!numbers.length) {
      return {
        ready: false,
        status: "ACTION_REQUIRED",
        httpStatus: numbersRes.status,
        requiredScope: GHL_PHONE_SYSTEM_READONLY_SCOPE,
        additionalScopesNeeded: [GHL_VOICE_SESSION_SCOPE],
        numbers: [],
        sessionReady: false,
        message:
          "GHL returned no location numbers. Use an existing LeadConnector number — do not buy a second-provider number.",
      };
    }

    const sessionRes = await ghlVoiceFetch("/phone-system/voice-ai", { method: "GET" });
    const sessionDenied = isScopeDenied(sessionRes.status, sessionRes.text);
    const sessionOk =
      sessionRes.status === 200 ||
      sessionRes.status === 400 ||
      sessionRes.status === 422;

    if (sessionDenied || !sessionOk) {
      return {
        ready: false,
        status: "ACTION_REQUIRED",
        httpStatus: sessionRes.status,
        requiredScope: GHL_VOICE_SESSION_SCOPE,
        additionalScopesNeeded: [GHL_PHONE_SYSTEM_READONLY_SCOPE],
        numbers,
        sessionReady: false,
        message:
          `Fail-closed: GHL voice session probe failed (HTTP ${sessionRes.status}). ` +
          `Required PIT scope: ${GHL_VOICE_SESSION_SCOPE}. Numbers listed (${numbers.length}) but e2e audio is not authorized.`,
      };
    }

    return {
      ready: true,
      status: "CONNECTED",
      httpStatus: sessionRes.status,
      requiredScope: GHL_VOICE_SESSION_SCOPE,
      additionalScopesNeeded: [GHL_PHONE_SYSTEM_READONLY_SCOPE],
      numbers,
      sessionReady: true,
      message: `GHL voice path ready · ${numbers.length} existing number(s).`,
    };
  } catch (err) {
    return {
      ready: false,
      status: "OFFLINE",
      requiredScope: GHL_PHONE_SYSTEM_READONLY_SCOPE,
      additionalScopesNeeded: [GHL_VOICE_SESSION_SCOPE],
      numbers: [],
      sessionReady: false,
      message: err instanceof Error ? err.message : "Voice probe failed",
    };
  }
}

export async function startGhlOutboundCall(input: {
  toE164: string;
  fromNumber?: string;
  contactId?: string;
  staffUserId: string;
}): Promise<VoiceCallResult> {
  const to = input.toE164.trim();
  if (!to) {
    return { ok: false, reason: "Destination number is required" };
  }
  const probe = await probeGhlVoicePath();
  if (!probe.ready) {
    return {
      ok: false,
      reason: probe.message,
      requiredScope: probe.requiredScope,
      additionalScopesNeeded: probe.additionalScopesNeeded,
      httpStatus: probe.httpStatus,
    };
  }
  const fromNumber = input.fromNumber?.trim() || probe.numbers[0]?.phone;
  if (!fromNumber) {
    return {
      ok: false,
      reason: "No existing GHL number available to place the call",
      requiredScope: GHL_PHONE_SYSTEM_READONLY_SCOPE,
    };
  }

  const payload: Record<string, unknown> = {
    to,
    from: fromNumber,
    locationId: getGhlApiConfig()?.locationId,
  };
  if (input.contactId) payload.contactId = input.contactId;
  if (input.staffUserId) payload.userId = input.staffUserId;

  const { status, text, json } = await ghlVoiceFetch("/phone-system/outbound-call", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const providerMessage =
    (typeof json?.message === "string" && json.message) || text.slice(0, 240);

  if (isScopeDenied(status, text) || status < 200 || status >= 300) {
    return {
      ok: false,
      reason:
        `Fail-closed: GHL outbound call failed (HTTP ${status}). Required scope: ${GHL_VOICE_SESSION_SCOPE}. ${providerMessage}`,
      requiredScope: GHL_VOICE_SESSION_SCOPE,
      additionalScopesNeeded: [GHL_PHONE_SYSTEM_READONLY_SCOPE],
      httpStatus: status,
    };
  }

  const sessionId = String(json?.id ?? json?.callId ?? json?.sessionId ?? "").trim();
  if (!sessionId) {
    return {
      ok: false,
      reason: "GHL accepted the call request without a session id — treating as ACTION_REQUIRED",
      requiredScope: GHL_VOICE_SESSION_SCOPE,
      httpStatus: status,
    };
  }

  return { ok: true, sessionId, fromNumber, toNumber: to };
}

export function getGhlVoiceAdapter() {
  return {
    name: "leadconnector" as const,
    requiredScope: GHL_VOICE_SESSION_SCOPE,
    additionalScopesNeeded: [GHL_PHONE_SYSTEM_READONLY_SCOPE],
    probe: probeGhlVoicePath,
    startCall: startGhlOutboundCall,
  };
}
