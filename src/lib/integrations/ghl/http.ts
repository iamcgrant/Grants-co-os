/**
 * LeadConnector / GoHighLevel HTTP client.
 * Inbound read-only contact sync. Never creates, updates, or deletes GHL contacts.
 * Never sends messages.
 */

import { getGhlApiConfig } from "@/lib/integrations/credentials";
import { GHL_API_KEY_ENV, GHL_LOCATION_ID_ENV } from "./location";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

/** Hard lock — this module must never grow contact write helpers. */
export const GHL_CONTACT_WRITES_ENABLED = false;

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
  source?: string | null;
  dateAdded?: string | null;
  dateUpdated?: string | null;
  customFields?: unknown[];
};

export type GhlSearchResult = {
  contacts: GhlApiContact[];
  total?: number;
};

export class GhlApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
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

/**
 * Fail closed: only GET contact reads and POST /contacts/search are allowed.
 * Refuses create/update/delete of GHL contacts.
 */
export function assertGhlInboundOnly(method: string, path: string) {
  if (GHL_CONTACT_WRITES_ENABLED) {
    throw new GhlApiError("GHL contact writes are disabled", 403);
  }
  const m = (method || "GET").toUpperCase();
  let pathname = path;
  try {
    pathname = path.startsWith("http") ? new URL(path).pathname : path;
  } catch {
    pathname = path;
  }
  if (m === "GET") return;
  if (m === "POST" && /\/contacts\/search\/?$/.test(pathname)) return;
  throw new GhlApiError(
    "Inbound-only GHL client refuses writes — will not create, update, or delete GHL contacts",
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
    throw new GhlApiError(`GHL API ${res.status}: ${path}`, res.status, text.slice(0, 500));
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
