/**
 * GoHighLevel — external CRM/comms provider adapter.
 * GHL is NEVER the master client database.
 */
import { isGhlApiReady } from "./ghl/http";

export type GhlContact = {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  assignedUserId?: string;
  pipelineStage?: string;
};

export interface GoHighLevelProvider {
  readonly name: "gohighlevel";
  syncContact(contact: GhlContact): Promise<{ grantsClientId?: string; action: string }>;
  listRecentMessages(contactId: string): Promise<
    { id: string; direction: string; body: string; status: string; at: string }[]
  >;
  getPipelineInfo(contactId: string): Promise<{ stage?: string; pipeline?: string }>;
}

export class MockGoHighLevelProvider implements GoHighLevelProvider {
  readonly name = "gohighlevel" as const;
  private contacts = new Map<string, GhlContact>();

  async syncContact(contact: GhlContact) {
    this.contacts.set(contact.id, contact);
    return { action: "SYNCED_MOCK", grantsClientId: undefined };
  }

  async listRecentMessages(contactId: string) {
    if (!this.contacts.has(contactId)) return [];
    return [
      {
        id: `ghl_msg_1`,
        direction: "outbound",
        body: "Welcome to Grants & Co — mock GHL message",
        status: "delivered",
        at: new Date().toISOString(),
      },
    ];
  }

  async getPipelineInfo(contactId: string) {
    const c = this.contacts.get(contactId);
    return { stage: c?.pipelineStage || "New Lead", pipeline: "Credit Optimization" };
  }
}

/**
 * DisputeFox — DisputeProcessingProvider.
 * Integrate beneath Grants & Co OS; do not rebuild yet.
 */
export type DisputeFoxClientStatus = {
  externalId: string;
  processingStatus: string;
  disputeRound: number;
  fileProgress: number;
};

export interface DisputeProcessingProvider {
  readonly name: string;
  getClientStatus(externalId: string): Promise<DisputeFoxClientStatus>;
  listDocumentEvents(externalId: string): Promise<
    { id: string; type: string; at: string }[]
  >;
}

export class MockDisputeFoxProvider implements DisputeProcessingProvider {
  readonly name = "disputefox";

  async getClientStatus(externalId: string): Promise<DisputeFoxClientStatus> {
    return {
      externalId,
      processingStatus: "IN_PROGRESS",
      disputeRound: 2,
      fileProgress: 65,
    };
  }

  async listDocumentEvents(externalId: string) {
    return [
      { id: `${externalId}_doc_1`, type: "ROUND_STARTED", at: new Date().toISOString() },
      { id: `${externalId}_doc_2`, type: "LETTER_GENERATED", at: new Date().toISOString() },
    ];
  }
}

/**
 * Live GHL adapter — read contact + pipeline only.
 * Message listing stays empty until a dedicated inbound sync is enabled (no live sends).
 */
export class LiveGoHighLevelProvider implements GoHighLevelProvider {
  readonly name = "gohighlevel" as const;

  async syncContact(contact: GhlContact) {
    const { syncGhlContactById } = await import("./ghl/sync");
    const result = await syncGhlContactById(contact.id);
    return { action: result.action, grantsClientId: result.grantsClientId };
  }

  async listRecentMessages(_contactId: string) {
    // Inbox import lives in ghl/conversations.ts (read-only, linked masters).
    // This adapter does not send and does not create a second pull path.
    return [];
  }

  async getPipelineInfo(_contactId: string) {
    return { stage: undefined, pipeline: undefined };
  }
}

export function getGhlProvider(): GoHighLevelProvider {
  if (isGhlApiReady()) return new LiveGoHighLevelProvider();
  return new MockGoHighLevelProvider();
}

export function getDisputeProvider(): DisputeProcessingProvider {
  // Preserve existing DisputeFox → GHL / mock path — do not replace with a new stack.
  return new MockDisputeFoxProvider();
}

/**
 * Credit Repair Cloud — not connected.
 * Inbound compare is local CSV dry-run only. Live HTTP fails closed without CRC_API_KEY.
 */
export type CrcClientStatus = {
  externalId: string;
  status: "NOT_CONNECTED";
};

export interface CreditRepairCloudProvider {
  readonly name: "credit_repair_cloud";
  getClientStatus(externalId: string): Promise<CrcClientStatus>;
}

export class MockCreditRepairCloudProvider implements CreditRepairCloudProvider {
  readonly name = "credit_repair_cloud" as const;

  async getClientStatus(externalId: string): Promise<CrcClientStatus> {
    return { externalId, status: "NOT_CONNECTED" };
  }
}

export function getCrcProvider(): CreditRepairCloudProvider {
  return new MockCreditRepairCloudProvider();
}
