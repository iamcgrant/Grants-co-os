import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listTelegramTeamChats,
  probeTelegramTeam,
  sendTelegramTeamMessage,
  TELEGRAM_BOT_TOKEN_ENV,
  TELEGRAM_TEAM_CHAT_IDS_ENV,
} from "../src/lib/integrations/telegram/workspace";

const originalFetch = globalThis.fetch;

describe("Telegram team desk", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    delete process.env[TELEGRAM_BOT_TOKEN_ENV];
    delete process.env[TELEGRAM_TEAM_CHAT_IDS_ENV];
  });

  it("fails closed without TELEGRAM_BOT_TOKEN and does not call Telegram", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const probe = await probeTelegramTeam();
    expect(probe.ready).toBe(false);
    expect(probe.status).toBe("ACTION_REQUIRED");
    expect(probe.requiredEnv).toBe(TELEGRAM_BOT_TOKEN_ENV);
    expect(probe.message).toMatch(/TELEGRAM_BOT_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists configured team chats after getMe + getChat succeed", async () => {
    process.env[TELEGRAM_BOT_TOKEN_ENV] = "test:token";
    process.env[TELEGRAM_TEAM_CHAT_IDS_ENV] = "-1001";
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("getMe")) {
        return new Response(JSON.stringify({ ok: true, result: { username: "grants_team_bot" } }), {
          status: 200,
        });
      }
      if (url.includes("getChat")) {
        return new Response(
          JSON.stringify({ ok: true, result: { id: -1001, title: "Simon / CS", type: "supergroup" } }),
          { status: 200 },
        );
      }
      if (url.includes("getUpdates")) {
        return new Response(
          JSON.stringify({
            ok: true,
            result: [
              {
                message: {
                  message_id: 9,
                  text: "Need a file",
                  date: 1787372400,
                  chat: { id: -1001, title: "Simon / CS", type: "supergroup" },
                },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const probe = await probeTelegramTeam();
    expect(probe.ready).toBe(true);
    expect(probe.status).toBe("CONNECTED");
    expect(probe.botUsername).toBe("grants_team_bot");

    const chats = await listTelegramTeamChats();
    expect(chats.ready).toBe(true);
    expect(chats.chats[0]?.title).toBe("Simon / CS");
  });

  it("sendMessage fails closed when the bot token is rejected", async () => {
    process.env[TELEGRAM_BOT_TOKEN_ENV] = "test:token";
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, description: "Unauthorized" }), { status: 401 }),
    ) as unknown as typeof fetch;

    const sent = await sendTelegramTeamMessage({ chatId: "-1001", body: "hello" });
    expect(sent.ok).toBe(false);
    expect(sent.requiredEnv).toBe(TELEGRAM_BOT_TOKEN_ENV);
  });
});
