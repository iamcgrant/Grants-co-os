/**
 * Work Gmail inbox — official Gmail API only. No scrape.
 * Env: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, optional GMAIL_USER.
 */

export const GMAIL_CLIENT_ID_ENV = "GMAIL_CLIENT_ID";
export const GMAIL_CLIENT_SECRET_ENV = "GMAIL_CLIENT_SECRET";
export const GMAIL_REFRESH_TOKEN_ENV = "GMAIL_REFRESH_TOKEN";
export const GMAIL_USER_ENV = "GMAIL_USER";

export const GMAIL_REQUIRED_ENV = [
  GMAIL_CLIENT_ID_ENV,
  GMAIL_CLIENT_SECRET_ENV,
  GMAIL_REFRESH_TOKEN_ENV,
] as const;

export type GmailHealthStatus = "CONNECTED" | "ACTION_REQUIRED" | "OFFLINE";

export type GmailMessage = {
  id: string;
  threadId: string;
  from: string | null;
  subject: string | null;
  snippet: string | null;
  date: string | null;
};

export type GmailInboxResult = {
  ready: boolean;
  failedClosed?: boolean;
  messages: GmailMessage[];
  mailbox: string;
  requiredEnv: readonly string[];
  message: string;
};

export type GmailProbeResult = {
  ready: boolean;
  status: GmailHealthStatus;
  detail: string;
  requiredEnv: readonly string[];
  lastSuccessAt: string | null;
};

export type GmailFetch = typeof fetch;

function envValue(name: string): string | null {
  return process.env[name]?.trim() || null;
}

export function gmailUser(): string {
  return envValue(GMAIL_USER_ENV) || "me";
}

export function isGmailConfigured(): boolean {
  return GMAIL_REQUIRED_ENV.every((name) => Boolean(envValue(name)));
}

export function missingGmailEnv(): string[] {
  return GMAIL_REQUIRED_ENV.filter((name) => !envValue(name));
}

function headerValue(headers: Array<{ name?: string; value?: string }> | undefined, name: string) {
  if (!headers) return null;
  const hit = headers.find((header) => header.name?.toLowerCase() === name.toLowerCase());
  return hit?.value?.trim() || null;
}

async function gmailAccessToken(fetchImpl: GmailFetch): Promise<string> {
  const clientId = envValue(GMAIL_CLIENT_ID_ENV);
  const clientSecret = envValue(GMAIL_CLIENT_SECRET_ENV);
  const refreshToken = envValue(GMAIL_REFRESH_TOKEN_ENV);
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(`Fail-closed: set ${GMAIL_REQUIRED_ENV.join(", ")}`);
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Fail-closed: Gmail token refresh rejected (HTTP ${res.status}). Reissue GMAIL_REFRESH_TOKEN.`);
  }
  const json = JSON.parse(text) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Fail-closed: Gmail token response had no access_token.");
  }
  return json.access_token;
}

async function gmailGet<T>(path: string, token: string, fetchImpl: GmailFetch): Promise<T> {
  const user = encodeURIComponent(gmailUser());
  const res = await fetchImpl(`https://gmail.googleapis.com/gmail/v1/users/${user}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Fail-closed: Gmail API ${path} rejected (HTTP ${res.status}).`);
  }
  return JSON.parse(text) as T;
}

export async function listGmailInbox(input: {
  limit?: number;
  fetchImpl?: GmailFetch;
} = {}): Promise<GmailInboxResult> {
  const mailbox = gmailUser();
  if (!isGmailConfigured()) {
    return {
      ready: false,
      failedClosed: true,
      messages: [],
      mailbox,
      requiredEnv: GMAIL_REQUIRED_ENV,
      message: `Fail-closed: set ${missingGmailEnv().join(", ")} for the official Gmail API. No scrape.`,
    };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

  try {
    const token = await gmailAccessToken(fetchImpl);
    const listed = await gmailGet<{ messages?: Array<{ id: string; threadId?: string }> }>(
      `/messages?maxResults=${limit}&labelIds=INBOX`,
      token,
      fetchImpl,
    );
    const messages: GmailMessage[] = [];
    for (const row of listed.messages || []) {
      const full = await gmailGet<{
        id: string;
        threadId?: string;
        snippet?: string;
        payload?: { headers?: Array<{ name?: string; value?: string }> };
      }>(`/messages/${encodeURIComponent(row.id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, token, fetchImpl);
      messages.push({
        id: full.id,
        threadId: full.threadId || row.threadId || full.id,
        from: headerValue(full.payload?.headers, "From"),
        subject: headerValue(full.payload?.headers, "Subject"),
        snippet: full.snippet || null,
        date: headerValue(full.payload?.headers, "Date"),
      });
    }
    return {
      ready: true,
      messages,
      mailbox,
      requiredEnv: GMAIL_REQUIRED_ENV,
      message: messages.length
        ? `Loaded ${messages.length} Gmail inbox message(s).`
        : "Official Gmail API reached · inbox is empty.",
    };
  } catch (err) {
    return {
      ready: false,
      failedClosed: true,
      messages: [],
      mailbox,
      requiredEnv: GMAIL_REQUIRED_ENV,
      message: err instanceof Error ? err.message : "Gmail inbox failed",
    };
  }
}

export async function probeGmailInbox(fetchImpl?: GmailFetch): Promise<GmailProbeResult> {
  if (!isGmailConfigured()) {
    return {
      ready: false,
      status: "ACTION_REQUIRED",
      detail: `Fail-closed: set ${GMAIL_REQUIRED_ENV.join(", ")} for work Gmail. Official API only · no scrape.`,
      requiredEnv: GMAIL_REQUIRED_ENV,
      lastSuccessAt: null,
    };
  }
  const inbox = await listGmailInbox({ limit: 1, fetchImpl });
  if (!inbox.ready) {
    return {
      ready: false,
      status: inbox.message.includes("HTTP") ? "OFFLINE" : "ACTION_REQUIRED",
      detail: inbox.message,
      requiredEnv: GMAIL_REQUIRED_ENV,
      lastSuccessAt: null,
    };
  }
  return {
    ready: true,
    status: "CONNECTED",
    detail: inbox.message,
    requiredEnv: GMAIL_REQUIRED_ENV,
    lastSuccessAt: new Date().toISOString(),
  };
}
