/**
 * Telegram team desk (staff-only). Not a client channel. Not GHL.
 * Bot API only — no scrape, no t.me link list as the product.
 */

export const TELEGRAM_BOT_TOKEN_ENV = "TELEGRAM_BOT_TOKEN";
export const TELEGRAM_TEAM_CHAT_IDS_ENV = "TELEGRAM_TEAM_CHAT_IDS";

const TELEGRAM_API = "https://api.telegram.org";

export type TelegramChat = {
  id: string;
  title: string;
  type: string;
  lastMessage?: string;
  lastAt?: string;
};

export type TelegramMessage = {
  id: string;
  chatId: string;
  body: string;
  from: string;
  date: string;
  outgoing: boolean;
};

export type TelegramProbeResult = {
  ready: boolean;
  status: "CONNECTED" | "ACTION_REQUIRED" | "OFFLINE";
  requiredEnv: string;
  httpStatus?: number;
  botUsername?: string;
  chatCount: number;
  message: string;
};

function botToken(): string | null {
  return process.env[TELEGRAM_BOT_TOKEN_ENV]?.trim() || null;
}

function configuredChatIds(): string[] {
  return (process.env[TELEGRAM_TEAM_CHAT_IDS_ENV] || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

async function telegramCall(method: string, body?: Record<string, unknown>) {
  const token = botToken();
  if (!token) {
    throw new Error(`${TELEGRAM_BOT_TOKEN_ENV} is not configured`);
  }
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
    result?: unknown;
  } | null;
  return { status: res.status, json };
}

function chatTitle(chat: Record<string, unknown>): string {
  if (typeof chat.title === "string" && chat.title.trim()) return chat.title.trim();
  const first = typeof chat.first_name === "string" ? chat.first_name : "";
  const last = typeof chat.last_name === "string" ? chat.last_name : "";
  const username = typeof chat.username === "string" ? `@${chat.username}` : "";
  return [first, last].filter(Boolean).join(" ") || username || String(chat.id);
}

export async function probeTelegramTeam(): Promise<TelegramProbeResult> {
  if (!botToken()) {
    return {
      ready: false,
      status: "ACTION_REQUIRED",
      requiredEnv: TELEGRAM_BOT_TOKEN_ENV,
      chatCount: 0,
      message: `Fail-closed: ${TELEGRAM_BOT_TOKEN_ENV} is not set. Create a Telegram bot and add it to Simon / CS / disputes team chats. Optional ${TELEGRAM_TEAM_CHAT_IDS_ENV} lists those chat ids.`,
    };
  }

  try {
    const me = await telegramCall("getMe");
    if (me.status === 401 || me.json?.ok === false) {
      return {
        ready: false,
        status: "ACTION_REQUIRED",
        requiredEnv: TELEGRAM_BOT_TOKEN_ENV,
        httpStatus: me.status,
        chatCount: 0,
        message:
          `Fail-closed: Telegram getMe rejected the token (HTTP ${me.status}). Reissue ${TELEGRAM_BOT_TOKEN_ENV}.`,
      };
    }
    const result = (me.json?.result || {}) as Record<string, unknown>;
    const username = typeof result.username === "string" ? result.username : undefined;
    const chats = await listTelegramTeamChats();
    if (!chats.ready) {
      return {
        ready: false,
        status: "ACTION_REQUIRED",
        requiredEnv: chats.requiredEnv || TELEGRAM_TEAM_CHAT_IDS_ENV,
        httpStatus: chats.httpStatus,
        botUsername: username,
        chatCount: 0,
        message: chats.message,
      };
    }
    return {
      ready: true,
      status: "CONNECTED",
      requiredEnv: TELEGRAM_BOT_TOKEN_ENV,
      httpStatus: me.status,
      botUsername: username,
      chatCount: chats.chats.length,
      message: `Telegram bot @${username || "bot"} can read/send ${chats.chats.length} team chat(s).`,
    };
  } catch (err) {
    return {
      ready: false,
      status: "OFFLINE",
      requiredEnv: TELEGRAM_BOT_TOKEN_ENV,
      chatCount: 0,
      message: err instanceof Error ? err.message : "Telegram probe failed",
    };
  }
}

export async function listTelegramTeamChats(): Promise<{
  ready: boolean;
  chats: TelegramChat[];
  requiredEnv?: string;
  httpStatus?: number;
  message: string;
}> {
  if (!botToken()) {
    return {
      ready: false,
      chats: [],
      requiredEnv: TELEGRAM_BOT_TOKEN_ENV,
      message: `Fail-closed: ${TELEGRAM_BOT_TOKEN_ENV} is not set.`,
    };
  }

  const configured = configuredChatIds();
  const chats = new Map<string, TelegramChat>();

  for (const chatId of configured) {
    const res = await telegramCall("getChat", { chat_id: chatId });
    if (res.json?.ok && res.json.result && typeof res.json.result === "object") {
      const chat = res.json.result as Record<string, unknown>;
      chats.set(chatId, {
        id: String(chat.id ?? chatId),
        title: chatTitle(chat),
        type: String(chat.type || "group"),
      });
    }
  }

  const updates = await telegramCall("getUpdates", { limit: 50, timeout: 0 });
  if (updates.status === 401 || updates.json?.ok === false) {
    return {
      ready: false,
      chats: [...chats.values()],
      requiredEnv: TELEGRAM_BOT_TOKEN_ENV,
      httpStatus: updates.status,
      message: `Fail-closed: Telegram getUpdates failed (HTTP ${updates.status}).`,
    };
  }

  const rows = Array.isArray(updates.json?.result) ? updates.json.result : [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const message = (row as { message?: Record<string, unknown> }).message;
    const chat = message?.chat as Record<string, unknown> | undefined;
    if (!chat?.id) continue;
    const id = String(chat.id);
    if (configured.length && !configured.includes(id)) continue;
    const text = typeof message?.text === "string" ? message.text : "";
    const date =
      typeof message?.date === "number" ? new Date(message.date * 1000).toISOString() : undefined;
    const existing = chats.get(id);
    chats.set(id, {
      id,
      title: existing?.title || chatTitle(chat),
      type: String(chat.type || existing?.type || "group"),
      lastMessage: text || existing?.lastMessage,
      lastAt: date || existing?.lastAt,
    });
  }

  const list = [...chats.values()].sort((a, b) => (b.lastAt || "").localeCompare(a.lastAt || ""));
  if (!list.length) {
    return {
      ready: false,
      chats: [],
      requiredEnv: TELEGRAM_TEAM_CHAT_IDS_ENV,
      message:
        `Telegram bot is reachable but no team chats are visible. Add the bot to Simon / CS / disputes chats and set ${TELEGRAM_TEAM_CHAT_IDS_ENV}.`,
    };
  }

  return {
    ready: true,
    chats: list,
    message: `Loaded ${list.length} Telegram team chat(s).`,
  };
}

export async function listTelegramChatMessages(chatId: string): Promise<{
  ready: boolean;
  messages: TelegramMessage[];
  message: string;
}> {
  if (!botToken()) {
    return {
      ready: false,
      messages: [],
      message: `Fail-closed: ${TELEGRAM_BOT_TOKEN_ENV} is not set.`,
    };
  }
  const updates = await telegramCall("getUpdates", { limit: 100, timeout: 0 });
  if (updates.json?.ok === false) {
    return {
      ready: false,
      messages: [],
      message: `Fail-closed: Telegram getUpdates failed (HTTP ${updates.status}).`,
    };
  }
  const rows = Array.isArray(updates.json?.result) ? updates.json.result : [];
  const messages: TelegramMessage[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const message = (row as { message?: Record<string, unknown> }).message;
    const chat = message?.chat as Record<string, unknown> | undefined;
    if (String(chat?.id) !== String(chatId)) continue;
    const from = (message?.from as Record<string, unknown> | undefined) || {};
    messages.push({
      id: String(message?.message_id ?? ""),
      chatId: String(chatId),
      body: typeof message?.text === "string" ? message.text : "[non-text message]",
      from: String(from.username || from.first_name || "member"),
      date:
        typeof message?.date === "number"
          ? new Date(message.date * 1000).toISOString()
          : new Date().toISOString(),
      outgoing: Boolean(from.is_bot),
    });
  }
  return {
    ready: true,
    messages,
    message: `Loaded ${messages.length} Telegram message(s).`,
  };
}

export async function sendTelegramTeamMessage(input: {
  chatId: string;
  body: string;
}): Promise<{ ok: boolean; messageId?: string; reason?: string; requiredEnv?: string }> {
  if (!botToken()) {
    return {
      ok: false,
      reason: `Fail-closed: ${TELEGRAM_BOT_TOKEN_ENV} is not set.`,
      requiredEnv: TELEGRAM_BOT_TOKEN_ENV,
    };
  }
  const chatId = input.chatId.trim();
  const body = input.body.trim();
  if (!chatId || !body) {
    return { ok: false, reason: "chatId and body are required" };
  }
  const allowed = configuredChatIds();
  if (allowed.length && !allowed.includes(chatId)) {
    return {
      ok: false,
      reason: `Chat is not in ${TELEGRAM_TEAM_CHAT_IDS_ENV}`,
      requiredEnv: TELEGRAM_TEAM_CHAT_IDS_ENV,
    };
  }
  const res = await telegramCall("sendMessage", { chat_id: chatId, text: body });
  if (!res.json?.ok) {
    return {
      ok: false,
      reason: res.json?.description || `Telegram sendMessage failed (HTTP ${res.status})`,
      requiredEnv: TELEGRAM_BOT_TOKEN_ENV,
    };
  }
  const result = (res.json.result || {}) as Record<string, unknown>;
  return { ok: true, messageId: String(result.message_id ?? "") };
}
