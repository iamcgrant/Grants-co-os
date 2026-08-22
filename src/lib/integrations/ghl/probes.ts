/**
 * Live GHL comms probes. A key or a historic SENT row is never enough for CONNECTED.
 */

import { getGhlApiConfig } from "@/lib/integrations/credentials";
import {
  GhlApiError,
  isGhlApiReady,
  isGhlAuthScopeError,
  searchGhlConversations,
} from "./http";
import {
  GHL_API_KEY_ENV,
  GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE,
  GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE,
  GHL_CONVERSATIONS_READONLY_SCOPE,
  GHL_CONVERSATIONS_WRITE_SCOPE,
} from "./location";
import { probeGhlOutboundSendScope } from "./outbound";
import { probeGhlVoicePath, type VoiceProbeResult } from "./voice";

export type CommsProbe = {
  ready: boolean;
  status: "CONNECTED" | "ACTION_REQUIRED" | "OFFLINE";
  requiredScope: string;
  additionalScopesNeeded: string[];
  requiredSecrets?: string[];
  httpStatus?: number;
  message: string;
};

export async function probeGhlInboundReceive(): Promise<CommsProbe> {
  if (!isGhlApiReady()) {
    return {
      ready: false,
      status: "ACTION_REQUIRED",
      requiredScope: GHL_CONVERSATIONS_READONLY_SCOPE,
      additionalScopesNeeded: [GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE],
      requiredSecrets: [GHL_API_KEY_ENV],
      message: `Fail-closed: ${GHL_API_KEY_ENV} is not set.`,
    };
  }
  try {
    await searchGhlConversations({ limit: 1 });
    return {
      ready: true,
      status: "CONNECTED",
      requiredScope: GHL_CONVERSATIONS_READONLY_SCOPE,
      additionalScopesNeeded: [GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE],
      message: "GHL conversation receive path responded.",
    };
  } catch (err) {
    if (err instanceof GhlApiError && isGhlAuthScopeError(err)) {
      return {
        ready: false,
        status: "ACTION_REQUIRED",
        requiredScope: err.requiredScope || GHL_CONVERSATIONS_READONLY_SCOPE,
        additionalScopesNeeded: [GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE],
        httpStatus: err.status,
        message:
          `Fail-closed: PIT missing ${err.requiredScope || GHL_CONVERSATIONS_READONLY_SCOPE}. ` +
          (err.body ? `Provider: ${err.body.slice(0, 160)}` : ""),
      };
    }
    return {
      ready: false,
      status: "OFFLINE",
      requiredScope: GHL_CONVERSATIONS_READONLY_SCOPE,
      additionalScopesNeeded: [GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE],
      message: err instanceof Error ? err.message : "Inbound conversation probe failed",
    };
  }
}

export async function probeGhlSmsEmailPath(): Promise<CommsProbe> {
  if (!getGhlApiConfig()?.apiKey) {
    return {
      ready: false,
      status: "ACTION_REQUIRED",
      requiredScope: GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE,
      additionalScopesNeeded: [GHL_CONVERSATIONS_WRITE_SCOPE],
      requiredSecrets: [GHL_API_KEY_ENV],
      message: `Fail-closed: ${GHL_API_KEY_ENV} is not set. Required PIT scope: ${GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE}.`,
    };
  }
  const [send, receive] = await Promise.all([
    probeGhlOutboundSendScope(),
    probeGhlInboundReceive(),
  ]);
  if (!send.ready) {
    return {
      ready: false,
      status: send.status,
      requiredScope: send.requiredScope,
      additionalScopesNeeded: [GHL_CONVERSATIONS_WRITE_SCOPE],
      httpStatus: send.httpStatus,
      message: send.message,
    };
  }
  if (!receive.ready) {
    return {
      ready: false,
      status: receive.status,
      requiredScope: receive.requiredScope,
      additionalScopesNeeded: receive.additionalScopesNeeded,
      httpStatus: receive.httpStatus,
      message: receive.message,
    };
  }
  return {
    ready: true,
    status: "CONNECTED",
    requiredScope: GHL_CONVERSATIONS_MESSAGE_WRITE_SCOPE,
    additionalScopesNeeded: [GHL_CONVERSATIONS_WRITE_SCOPE, GHL_CONVERSATIONS_READONLY_SCOPE],
    httpStatus: send.httpStatus,
    message: "GHL SMS/email send + receive probes succeeded.",
  };
}

export async function probeGhlVoiceHealth(): Promise<VoiceProbeResult> {
  return probeGhlVoicePath();
}
