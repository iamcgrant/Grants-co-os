/**
 * Telephony adapter — honest interface for LeadConnector / GHL voice.
 * Browser dialer is only enabled when the provider exposes a supported session API.
 */

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
    // LeadConnector does not currently expose a documented browser WebRTC dialer
    // for this Grants account path. Keep UI honest — do not pretend Answer works.
    return {
      browserDialer: false,
      inboundScreenPop: true, // OS can match Master Client on inbound CLI when webhook arrives
      transfer: false,
      recordings: false,
      transcripts: false,
      voicemail: false,
    };
  }

  async startOutboundSession(): Promise<{ ok: false; reason: string }> {
    return {
      ok: false,
      reason:
        "Browser dialer unavailable: configure a telephony provider that exposes supported voice sessions, or place the call from the LeadConnector softphone while OS owns the client timeline.",
    };
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
