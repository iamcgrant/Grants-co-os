/**
 * Telephony adapter — LeadConnector / GHL voice only.
 * No Twilio, Telnyx, or second provider. Browser dialer is on only after a live probe.
 */

import { startGhlOutboundCall, probeGhlVoicePath } from "@/lib/integrations/ghl/voice";

export type CallDirection = "INBOUND" | "OUTBOUND";

export type TelephonyCapabilities = {
  browserDialer: boolean;
  inboundScreenPop: boolean;
  transfer: boolean;
  recordings: boolean;
  transcripts: boolean;
  voicemail: boolean;
};

export type IncomingCallPresentation = {
  fromE164: string;
  masterClientId: string | null;
  grantsClientId: string | null;
  displayName: string;
  status: string;
  assignedStaff: string | null;
  serviceName: string | null;
};

export interface TelephonyProvider {
  readonly name: string;
  capabilities(): TelephonyCapabilities;
  /** Start an outbound browser session if supported; otherwise returns ACTION_REQUIRED. */
  startOutboundSession(input: {
    toE164: string;
    clientId?: string;
    staffUserId: string;
  }): Promise<{ ok: true; sessionId: string } | { ok: false; reason: string }>;
}

export class LeadConnectorTelephonyAdapter implements TelephonyProvider {
  readonly name = "leadconnector";

  capabilities(): TelephonyCapabilities {
    return {
      browserDialer: true,
      inboundScreenPop: true,
      transfer: false,
      recordings: false,
      transcripts: false,
      voicemail: false,
    };
  }

  async startOutboundSession(input: {
    toE164: string;
    clientId?: string;
    staffUserId: string;
  }): Promise<{ ok: true; sessionId: string } | { ok: false; reason: string; requiredScope?: string }> {
    const probe = await probeGhlVoicePath();
    if (!probe.ready) {
      return { ok: false, reason: probe.message, requiredScope: probe.requiredScope };
    }
    const started = await startGhlOutboundCall({
      toE164: input.toE164,
      staffUserId: input.staffUserId,
    });
    if (!started.ok) {
      return { ok: false, reason: started.reason, requiredScope: started.requiredScope };
    }
    return { ok: true, sessionId: started.sessionId };
  }
}

export function getTelephonyProvider(): TelephonyProvider {
  return new LeadConnectorTelephonyAdapter();
}

export function presentIncomingCall(input: {
  fromE164: string;
  client?: {
    id: string;
    grantsClientId: string;
    firstName: string;
    lastName: string;
    status: string;
    stage: string;
    assignments?: Array<{ roleLabel: string | null; staff: { firstName: string; lastName: string } }>;
    clientServices?: Array<{ service: { name: string } }>;
  } | null;
}): IncomingCallPresentation {
  const care = input.client?.assignments?.find((a) => a.roleLabel === "CUSTOMER_SERVICE");
  return {
    fromE164: input.fromE164,
    masterClientId: input.client?.id || null,
    grantsClientId: input.client?.grantsClientId || null,
    displayName: input.client
      ? `${input.client.firstName} ${input.client.lastName}`
      : input.fromE164,
    status: input.client?.status || "UNKNOWN",
    assignedStaff: care ? `${care.staff.firstName} ${care.staff.lastName}` : null,
    serviceName: input.client?.clientServices?.[0]?.service.name || null,
  };
}
