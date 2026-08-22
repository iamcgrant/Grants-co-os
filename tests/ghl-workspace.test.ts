import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";

const testDb = path.join(process.cwd(), "prisma", "test-ghl-workspace.db");

describe("GHL in-OS client desk", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  let loadGhlClientDesk: typeof import("../src/lib/integrations/ghl/workspace").loadGhlClientDesk;
  let sendGhlClientMessage: typeof import("../src/lib/integrations/ghl/workspace").sendGhlClientMessage;
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
    const workspace = await import("../src/lib/integrations/ghl/workspace");
    loadGhlClientDesk = workspace.loadGhlClientDesk;
    sendGhlClientMessage = workspace.sendGhlClientMessage;
    attachExternalIdentifier = (await import("../src/lib/clients/service")).attachExternalIdentifier;
  });

  beforeEach(async () => {
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.clientIdentifier.deleteMany();
    await prisma.client.deleteMany();
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

  async function seedLinked() {
    const client = await prisma.client.create({
      data: {
        grantsClientId: "GC-WS0001",
        email: "desk@example.com",
        emailNormalized: "desk@example.com",
        firstName: "Desk",
        lastName: "Client",
      },
    });
    await attachExternalIdentifier({
      clientId: client.id,
      provider: "GHL",
      externalId: "ghl_desk",
      metadata: { source: "ghl_api", dataPlane: "development" },
    });
    return client;
  }

  it("fails closed without GHL_API_KEY and does not call GHL", async () => {
    const client = await seedLinked();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const desk = await loadGhlClientDesk({ clientId: client.id });
    expect(desk.ready).toBe(false);
    expect(desk.failedClosed).toBe(true);
    expect(desk.requiredSecrets).toEqual(["GHL_API_KEY"]);
    expect(desk.requiredScope).toBe("conversations.readonly");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("loads GHL threads for a linked client", async () => {
    process.env.GHL_API_KEY = "test_key_not_real";
    process.env.GHL_LOCATION_ID = "loc_test";
    const client = await seedLinked();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/conversations/search")) {
        return new Response(
          JSON.stringify({
            conversations: [
              {
                id: "conv_sms",
                contactId: "ghl_desk",
                lastMessageBody: "Need an update",
                lastMessageType: "TYPE_SMS",
                lastMessageDate: "2026-08-01T12:00:00.000Z",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/conversations/conv_sms/messages")) {
        return new Response(
          JSON.stringify({
            messages: {
              messages: [
                {
                  id: "msg_1",
                  contactId: "ghl_desk",
                  body: "Need an update",
                  direction: "inbound",
                  messageType: "TYPE_SMS",
                  dateAdded: "2026-08-01T12:00:00.000Z",
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("{}", { status: 404 });
    });

    const desk = await loadGhlClientDesk({ clientId: client.id });
    expect(desk.ready).toBe(true);
    expect(desk.threads).toHaveLength(1);
    expect(desk.threads[0]?.channel).toBe("SMS");
    expect(desk.messages.map((m) => m.body)).toEqual(["Need an update"]);
  });

  it("send records FAILED + required scope when PIT lacks write", async () => {
    process.env.GHL_API_KEY = "test_key_not_real";
    process.env.GHL_LOCATION_ID = "loc_test";
    const client = await seedLinked();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "The token is not authorized for this scope." }), {
        status: 401,
      }),
    );

    const sent = await sendGhlClientMessage({
      clientId: client.id,
      channel: "SMS",
      body: "hello",
    });
    expect(sent.ok).toBe(false);
    expect(sent.requiredScope).toBe("conversations/message.write");
    expect(sent.actionRequired).toMatch(/conversations\/message\.write/);
    const row = await prisma.message.findFirst();
    expect(row?.deliveryStatus).toBe("FAILED");
    expect(row?.channel).toBe("SMS");
  });

  it("send succeeds for SMS and Email when GHL returns a message id", async () => {
    process.env.GHL_API_KEY = "test_key_not_real";
    process.env.GHL_LOCATION_ID = "loc_test";
    const client = await seedLinked();
    let n = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      n += 1;
      return new Response(
        JSON.stringify({ messageId: `msg_out_${n}`, conversationId: "conv_out" }),
        { status: 201 },
      );
    });

    const sms = await sendGhlClientMessage({ clientId: client.id, channel: "SMS", body: "ping" });
    expect(sms.ok).toBe(true);
    expect(sms.deliveryStatus).toBe("SENT");

    const email = await sendGhlClientMessage({
      clientId: client.id,
      channel: "Email",
      body: "Hello",
      subject: "Update",
    });
    expect(email.ok).toBe(true);
    const rows = await prisma.message.findMany({ orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.channel)).toEqual(["SMS", "EMAIL"]);
    expect(rows.every((r) => r.deliveryStatus === "SENT")).toBe(true);
  });
});
