/**
 * LeadConnector / GoHighLevel HTTP client.
 * Inbound read-only: contacts + conversations/messages.
 * Never creates, updates, or deletes GHL contacts.
 * Never sends SMS, email, or iMessage.
 * Never publishes workflows. Never touches A2P/phone/Sendara.
 */

import { getGhlApiConfig } from "@/lib/integrations/credentials";
import {
  GHL_API_KEY_ENV,
  GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE,
  GHL_CONVERSATIONS_READONLY_SCOPE,
  GHL_LOCATION_ID_ENV,
} from "./location";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

/** Hard locks — this module must never grow write / send helpers. */
export const GHL_CONTACT_WRITES_ENABLED = false;
export const GHL_MESSAGE_WRITES_ENABLED = false;
export const GHL_WORKFLOW_PUBLISH_ENABLED = false;

export type GhlApiContact = {
  id: string;
  locationId?: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  tags?: string[];
  assignedTo?: string | null;
  contactType?: string | null;
  /** GHL contact source label only. Do not map to LeadAttribution this PR. */
  source?: string | null;
  dateAdded?: string | null;
  dateUpdated?: string | null;
  customFields?: unknown[];
  dnd?: boolean;
  dndSettings?: unknown;
  optedOut?: boolean;
};

export type GhlSearchResult = {
  contacts: GhlApiContact[];
  total?: number;
};

export type GhlApiConversation = {
  id: string;
  contactId?: string | null;
  locationId?: string | null;
  lastMessageBody?: string | null;
  lastMessageType?: string | null;
  lastMessageDirection?: string | null;
  lastMessageDate?: string | null;
  dnd?: boolean;
  optedOut?: boolean;
  dndSettings?: unknown;
  contact?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type GhlApiMessage = {
  id: string;
  conversationId?: string | null;
  contactId?: string | null;
  locationId?: string | null;
  body?: string | null;
  html?: string | null;
  direction?: string | null;
  status?: string | null;
  type?: string | number | null;
  messageType?: string | null;
  contentType?: string | null;
  dateAdded?: string | null;
  dateUpdated?: string | null;
  userId?: string | null;
  source?: string | null;
  attachments?: unknown;
  dnd?: boolean;
  optedOut?: boolean;
  optOut?: boolean;
  unsubscribe?: boolean;
  doNotDisturb?: boolean;
  doNotContact?: boolean;
  dnc?: boolean;
  dndSettings?: unknown;
  [key: string]: unknown;
};

export class GhlApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
    public requiredScope?: string,
  ) {
    super(message);
    this.name = "GhlApiError";
  }
}

function requireConfig() {
  const config = getGhlApiConfig();
  if (!config?.apiKey) {
    throw new GhlApiError(`${GHL_API_KEY_ENV} is not configured`, 503);
  }
  if (!config.locationId) {
    throw new GhlApiError(`${GHL_LOCATION_ID_ENV} is not configured`, 503);
  }
  return { apiKey: config.apiKey, locationId: config.locationId };
}

function pathnameOf(path: string): string {
  try {
    return path.startsWith("http") ? new URL(path).pathname : path;
  } catch {
    return path;
  }
}

export function requiredGhlScopeForPath(path: string): string {
  const pathname = pathnameOf(path);
  if (/\/conversations\/[^/]+\/messages|\/conversations\/messages\//.test(pathname)) {
    return GHL_CONVERSATIONS_MESSAGE_READONLY_SCOPE;
  }
  if (/\/conversations/.test(pathname)) {
    return GHL_CONVERSATIONS_READONLY_SCOPE;
  }
  return "contacts.readonly";
}

export function isGhlAuthScopeError(err: GhlApiError): boolean {
  return err.status === 401 || err.status === 403;
}

/**
 * Fail closed: only GET contact/conversation reads and POST /contacts/search are allowed.
 * Refuses create/update/delete of GHL contacts, any message send, workflow publish,
 * and A2P/phone/Sendara paths.
 */
export function assertGhlInboundOnly(method: string, path: string) {
  if (GHL_CONTACT_WRITES_ENABLED || GHL_MESSAGE_WRITES_ENABLED || GHL_WORKFLOW_PUBLISH_ENABLED) {
    throw new GhlApiError("GHL writes and sends are disabled", 403);
  }
  const m = (method || "GET").toUpperCase();
  const pathname = pathnameOf(path);

  if (/\/(sendara|a2p)(\/|$)/i.test(pathname) || /\/phones?(\/|$)/i.test(pathname)) {
    throw new GhlApiError(
      "Inbound-only GHL client refuses A2P/phone/Sendara paths",
      403,
    );
  }
  if (/\/workflows/i.test(pathname) && m !== "GET") {
    throw new GhlApiError("Inbound-only GHL client refuses workflow publish", 403);
  }
  if (m !== "GET" && /\/conversations\/messages/i.test(pathname)) {
    throw new GhlApiError(
      "Inbound-only GHL client refuses outbound send — will not send SMS, email, or iMessage",
      403,
    );
  }
  if (m === "GET") {
    if (/^\/contacts(\/|$)/.test(pathname) || /^\/conversations(\/|$)/.test(pathname)) return;
    throw new GhlApiError("Inbound-only GHL client refuses this path", 403);
  }
  if (m === "POST" && /\/contacts\/search\/?$/.test(pathname)) return;
  throw new GhlApiError(
    "Inbound-only GHL client refuses writes — will not create, update, or delete GHL contacts, send SMS/email/iMessage, or publish workflows",
    403,
  );
}

async function ghlFetch<T>(
  path: string,
  init: RequestInit & { query?: Record<string, string> } = {},
): Promise<T> {
  assertGhlInboundOnly(init.method || "GET", path);
  const { apiKey } = requireConfig();
  const url = new URL(path.startsWith("http") ? path : `${GHL_BASE}${path}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);
  }

  const { query: _q, ...rest } = init;
  const res = await fetch(url.toString(), {
    ...rest,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: GHL_VERSION,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(rest.headers || {}),
    },
  });

  const text = await res.text();
  if (!res.ok) {
    const requiredScope =
      res.status === 401 || res.status === 403 ? requiredGhlScopeForPath(path) : undefined;
    throw new GhlApiError(
      `GHL API ${res.status}: ${path.startsWith("http") ? url.pathname : path}`,
      res.status,
      text.slice(0, 500),
      requiredScope,
    );
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export function isGhlApiReady(): boolean {
  const config = getGhlApiConfig();
  return Boolean(config?.apiKey && config.locationId);
}

export async function getGhlContact(contactId: string): Promise<GhlApiContact> {
  const data = await ghlFetch<{ contact: GhlApiContact }>(`/contacts/${encodeURIComponent(contactId)}`);
  return data.contact;
}

/**
 * Search contacts in the configured location.
 * Inbound only — does not create or update contacts in GHL.
 */
export async function searchGhlContacts(input: {
  query?: string;
  page?: number;
  pageLimit?: number;
}): Promise<GhlSearchResult> {
  const { locationId } = requireConfig();
  const pageLimit = Math.min(Math.max(input.pageLimit ?? 20, 1), 100);
  const body: Record<string, unknown> = {
    locationId,
    page: input.page ?? 1,
    pageLimit,
  };
  if (input.query?.trim()) body.query = input.query.trim();

  const data = await ghlFetch<{ contacts?: GhlApiContact[]; total?: number }>("/contacts/search", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    contacts: data.contacts || [],
    total: data.total,
  };
}

/**
 * List contacts for a location (fallback when search is empty / pagination).
 */
export async function listGhlContacts(input?: {
  limit?: number;
  startAfterId?: string;
}): Promise<GhlSearchResult> {
  const { locationId } = requireConfig();
  const query: Record<string, string> = {
    locationId,
    limit: String(Math.min(Math.max(input?.limit ?? 20, 1), 100)),
  };
  if (input?.startAfterId) query.startAfterId = input.startAfterId;

  const data = await ghlFetch<{ contacts?: GhlApiContact[]; meta?: { total?: number } }>(
    "/contacts/",
    { query },
  );

  return {
    contacts: data.contacts || [],
    total: data.meta?.total,
  };
}

export async function searchGhlConversations(input: {
  contactId?: string;
  limit?: number;
  startAfterDate?: string;
}): Promise<{ conversations: GhlApiConversation[]; total?: number }> {
  const { locationId } = requireConfig();
  const query: Record<string, string> = {
    locationId,
    limit: String(Math.min(Math.max(input.limit ?? 20, 1), 100)),
  };
  if (input.contactId?.trim()) query.contactId = input.contactId.trim();
  if (input.startAfterDate?.trim()) query.startAfterDate = input.startAfterDate.trim();

  const data = await ghlFetch<{ conversations?: GhlApiConversation[]; total?: number }>(
    "/conversations/search",
    { query },
  );

  return {
    conversations: data.conversations || [],
    total: data.total,
  };
}

function normalizeMessagesPayload(data: unknown): {
  messages: GhlApiMessage[];
  nextPage?: boolean;
  lastMessageId?: string;
} {
  if (!data || typeof data !== "object") return { messages: [] };
  const root = data as Record<string, unknown>;
  if (Array.isArray(root.messages)) {
    return {
      messages: root.messages as GhlApiMessage[],
      nextPage: Boolean(root.nextPage),
      lastMessageId: typeof root.lastMessageId === "string" ? root.lastMessageId : undefined,
    };
  }
  const wrapped = root.messages;
  if (wrapped && typeof wrapped === "object") {
    const inner = wrapped as Record<string, unknown>;
    if (Array.isArray(inner.messages)) {
      return {
        messages: inner.messages as GhlApiMessage[],
        nextPage: Boolean(inner.nextPage),
        lastMessageId: typeof inner.lastMessageId === "string" ? inner.lastMessageId : undefined,
      };
    }
  }
  return { messages: [] };
}

export async function listGhlConversationMessages(input: {
  conversationId: string;
  lastMessageId?: string;
  limit?: number;
}): Promise<{ messages: GhlApiMessage[]; nextPage?: boolean; lastMessageId?: string }> {
  const query: Record<string, string> = {
    limit: String(Math.min(Math.max(input.limit ?? 50, 1), 100)),
  };
  if (input.lastMessageId?.trim()) query.lastMessageId = input.lastMessageId.trim();

  const data = await ghlFetch<unknown>(
    `/conversations/${encodeURIComponent(input.conversationId)}/messages`,
    { query },
  );
  return normalizeMessagesPayload(data);
}
