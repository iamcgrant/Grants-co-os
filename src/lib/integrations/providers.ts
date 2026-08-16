/**
 * GoHighLevel — external CRM/comms provider adapter.
 * GHL is NEVER the master client database.
 */
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

export function getGhlProvider(): GoHighLevelProvider {
  return new MockGoHighLevelProvider();
}

export function getDisputeProvider(): DisputeProcessingProvider {
  return new MockDisputeFoxProvider();
}
