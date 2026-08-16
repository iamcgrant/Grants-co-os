import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const testDb = path.join(process.cwd(), "prisma", "test-ghl-conversations.db");

describe("GHL → Grants inbox conversation pull (linked masters only)", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  let pullGhlConversationsForLinkedMasters: typeof import("../src/lib/integrations/ghl/conversations").pullGhlConversationsForLinkedMasters;
  let extractCommsFlags: typeof import("../src/lib/integrations/ghl/conversations").extractCommsFlags;
  let attachExternalIdentifier: typeof import("../src/lib/clients/service").attachExternalIdentifier;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.GC_ENV = "development";
    delete process.env.GHL_API_KEY;
    delete process.env.GHL_LOCATION_ID;
    resetSqliteFromSchema(testDb);

    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;

    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
    const conv = await import("../src/lib/integrations/ghl/conversations");
    pullGhlConversationsForLinkedMasters = conv.pullGhlConversationsForLinkedMasters;
    extractCommsFlags = conv.extractCommsFlags;
    const clients = await import("../src/lib/clients/service");
    attachExternalIdentifier = clients.attachExternalIdentifier;
  });

  beforeEach(async () => {
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.integrationSyncEvent.deleteMany();
    await prisma.clientTimelineEvent.deleteMany();
    await prisma.auditLog.deleteMany().catch(() => undefined);
    await prisma.clientIdentifier.deleteMany();
    await prisma.client.deleteMany();
    await prisma.integrationConnection.deleteMany();
    await prisma.idSequence.deleteMany();
    delete process.env.GHL_API_KEY;
    delete process.env.GHL_LOCATION_ID;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  async function seedMaster(input: {
    grantsClientId: string;
    email: string;
    ghlId?: string;
    firstName?: string;
    lastName?: string;
  }) {
    const client = await prisma.client.create({
      data: {
        grantsClientId: input.grantsClientId,
        email: input.email,
        emailNormalized: normalizeEmail(input.email),
        firstName: input.firstName ?? "Test",
        lastName: input.lastName ?? "Client",
      },
    });
    if (input.ghlId) {
      await attachExternalIdentifier({
        clientId: client.id,
        provider: "GHL",
        externalId: input.ghlId,
        metadata: { source: "ghl_api", dataPlane: "development" },
      });
    }
    return client;
  }

  function mockGhl(handlers: (url: string) => { status: number; body: unknown }) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method || "GET").toUpperCase();
      if (method !== "GET") {
        return new Response(JSON.stringify({ error: "unexpected write" }), { status: 500 });
      }
      const result = handlers(url);
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { "Content-Type": "application/json" },
      });
    });
  }

  it("fails closed without GHL_API_KEY and does not call GHL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await seedMaster({ grantsClientId: "GC-000001", email: "linked@example.com", ghlId: "ghl_1" });
    const pull = await pullGhlConversationsForLinkedMasters({ dryRun: true });
    expect(pull.ready).toBe(false);
    expect(pull.failedClosed).toBe(true);
    expect(pull.requiredSecrets).toEqual(["GHL_API_KEY"]);
    expect(pull.requiredScope).toBe("conversations.readonly");
    expect(pull.additionalScopesNeeded).toContain("conversations/message.readonly");
    expect(pull.imported).toBe(0);
    expect(JSON.stringify(pull)).not.toMatch(/pit-|sk_|Bearer /i);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await prisma.message.count()).toBe(0);
    fetchSpy.mockRestore();
  });

  it("imports inbound GHL messages into the OS inbox for a linked master", async () => {
    process.env.GHL_API_KEY = "test_key_not_real";
    process.env.GHL_LOCATION_ID = "loc_test";
    const client = await seedMaster({
      grantsClientId: "GC-000010",
      email: "kim@example.com",
      ghlId: "ghl_linked",
      firstName: "Kim",
      lastName: "Linked",
    });

    mockGhl((url) => {
      if (url.includes("/conversations/search")) {
        return {
          status: 200,
          body: {
            conversations: [
              {
                id: "conv_1",
                contactId: "ghl_linked",
                dnd: true,
                dndSettings: { SMS: { status: "active" } },
              },
            ],
            total: 1,
          },
        };
      }
      if (url.includes("/conversations/conv_1/messages")) {
        return {
          status: 200,
          body: {
            messages: {
              nextPage: false,
              messages: [
                {
                  id: "msg_in_1",
                  contactId: "ghl_linked",
                  conversationId: "conv_1",
                  body: "Can you update my file?",
                  direction: "inbound",
                  messageType: "TYPE_SMS",
                  dateAdded: "2026-08-01T12:00:00.000Z",
                  optedOut: false,
                },
                {
                  id: "msg_out_hist",
                  contactId: "ghl_linked",
                  conversationId: "conv_1",
                  body: "We received your docs.",
                  direction: "outbound",
                  messageType: "TYPE_SMS",
                  dateAdded: "2026-08-01T12:05:00.000Z",
                },
              ],
            },
          },
        };
      }
      return { status: 404, body: { error: "unexpected" } };
    });

    const pull = await pullGhlConversationsForLinkedMasters();
    expect(pull.ready).toBe(true);
    expect(pull.failedClosed).toBeUndefined();
    expect(pull.linkedMasters).toBe(1);
    expect(pull.imported).toBe(2);
    expect(await prisma.client.count()).toBe(1);
    expect(await prisma.message.count()).toBe(2);

    const inbox = await prisma.conversation.findFirst({
      where: { clientId: client.id, kind: "CLIENT" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    expect(inbox).toBeTruthy();
    expect(inbox?.messages.map((m) => m.body)).toEqual([
      "Can you update my file?",
      "We received your docs.",
    ]);
    expect(inbox?.messages.every((m) => m.deliveryStatus === "RECORDED")).toBe(true);
    expect(inbox?.messages.every((m) => m.provider === "GHL")).toBe(true);
    expect(inbox?.messages[0]?.externalId).toBe("msg_in_1");

    const ident = await prisma.clientIdentifier.findFirst({
      where: { provider: "GHL", externalId: "ghl_linked" },
    });
    expect(ident?.metadataJson).toMatch(/"dnd":true/);
    expect(JSON.stringify(pull)).not.toContain("test_key_not_real");
  });

  it("does not import the same GHL message twice", async () => {
    process.env.GHL_API_KEY = "test_key_not_real";
    process.env.GHL_LOCATION_ID = "loc_test";
    await seedMaster({
      grantsClientId: "GC-000011",
      email: "dup@example.com",
      ghlId: "ghl_dup",
    });

    mockGhl((url) => {
      if (url.includes("/conversations/search")) {
        return {
          status: 200,
          body: { conversations: [{ id: "conv_dup", contactId: "ghl_dup" }] },
        };
      }
      if (url.includes("/messages")) {
        return {
          status: 200,
          body: {
            messages: {
              messages: [
                {
                  id: "msg_same",
                  contactId: "ghl_dup",
                  body: "Hello again",
                  direction: "inbound",
                  messageType: "TYPE_SMS",
                },
              ],
            },
          },
        };
      }
      return { status: 404, body: {} };
    });

    const first = await pullGhlConversationsForLinkedMasters();
    const second = await pullGhlConversationsForLinkedMasters();
    expect(first.imported).toBe(1);
    expect(second.imported).toBe(0);
    expect(second.duplicates).toBe(1);
    expect(await prisma.message.count()).toBe(1);
  });

  it("skips unlinked GHL contacts and does not create Grants clients", async () => {
    process.env.GHL_API_KEY = "test_key_not_real";
    process.env.GHL_LOCATION_ID = "loc_test";
    await seedMaster({
      grantsClientId: "GC-000012",
      email: "unlinked@example.com",
    });

    const fetchSpy = mockGhl(() => ({
      status: 200,
      body: {
        conversations: [{ id: "conv_other", contactId: "ghl_stranger" }],
      },
    }));

    const pull = await pullGhlConversationsForLinkedMasters();
    expect(pull.linkedMasters).toBe(0);
    expect(pull.imported).toBe(0);
    expect(await prisma.client.count()).toBe(1);
    expect(await prisma.message.count()).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("preserves opt-out / DND flags from the payload", () => {
    const flags = extractCommsFlags({
      dnd: true,
      optedOut: true,
      dndSettings: { Email: { status: "active" } },
      contact: { doNotContact: true },
    });
    expect(flags.dnd).toBe(true);
    expect(flags.optedOut).toBe(true);
    expect(flags.doNotContact).toBe(true);
    expect(flags.dndSettings).toEqual({ Email: { status: "active" } });
  });

  it("fails closed when the PIT cannot list conversations and names conversations.readonly", async () => {
    process.env.GHL_API_KEY = "test_key_not_real";
    process.env.GHL_LOCATION_ID = "loc_test";
    await seedMaster({
      grantsClientId: "GC-000013",
      email: "scope@example.com",
      ghlId: "ghl_scope",
    });

    mockGhl((url) => {
      if (url.includes("/conversations/search")) {
        return { status: 401, body: { message: "Unauthorized" } };
      }
      return { status: 500, body: { error: "should not list messages" } };
    });

    const pull = await pullGhlConversationsForLinkedMasters();
    expect(pull.ready).toBe(false);
    expect(pull.failedClosed).toBe(true);
    expect(pull.missingScope).toBe(true);
    expect(pull.requiredScope).toBe("conversations.readonly");
    expect(pull.additionalScopesNeeded).toContain("conversations/message.readonly");
    expect(pull.imported).toBe(0);
    expect(await prisma.message.count()).toBe(0);
    expect(await prisma.client.count()).toBe(1);
  });

  it("dry-run reports imports without writing inbox messages", async () => {
    process.env.GHL_API_KEY = "test_key_not_real";
    process.env.GHL_LOCATION_ID = "loc_test";
    await seedMaster({
      grantsClientId: "GC-000014",
      email: "dry@example.com",
      ghlId: "ghl_dry",
    });

    mockGhl((url) => {
      if (url.includes("/conversations/search")) {
        return { status: 200, body: { conversations: [{ id: "conv_dry", contactId: "ghl_dry" }] } };
      }
      return {
        status: 200,
        body: {
          messages: {
            messages: [
              {
                id: "msg_dry",
                contactId: "ghl_dry",
                body: "Preview only",
                direction: "inbound",
                messageType: "TYPE_EMAIL",
              },
            ],
          },
        },
      };
    });

    const pull = await pullGhlConversationsForLinkedMasters({ dryRun: true });
    expect(pull.dryRun).toBe(true);
    expect(pull.imported).toBe(1);
    expect(await prisma.message.count()).toBe(0);
    expect(await prisma.conversation.count()).toBe(0);
  });

  it("GHL integration sources have zero outbound send path", () => {
    const dir = path.join(process.cwd(), "src/lib/integrations/ghl");
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".ts")) continue;
      const src = fs.readFileSync(path.join(dir, file), "utf8");
      expect(src).not.toMatch(/\b(sendMessage|sendSms|sendEmail|sendIMessage|publishWorkflow)\s*\(/);
      expect(src).not.toMatch(/method:\s*["']POST["'][\s\S]*conversations\/messages/);
      expect(src).not.toMatch(/GHL_MESSAGE_WRITES_ENABLED = true/);
    }
    const http = fs.readFileSync(path.join(dir, "http.ts"), "utf8");
    expect(http).toMatch(/GHL_MESSAGE_WRITES_ENABLED = false/);
    expect(http).toMatch(/refuses outbound send/);
    const cli = fs.readFileSync(
      path.join(process.cwd(), "scripts/ghl-inbound-conversations.ts"),
      "utf8",
    );
    expect(cli).toMatch(/Never sends SMS\/email\/iMessage/);
    expect(cli).not.toMatch(/\b(sendMessage|sendSms|sendEmail)\s*\(/);
  });
});
