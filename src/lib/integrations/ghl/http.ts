/**
 * LeadConnector / GoHighLevel HTTP client.
 * Read-only contact sync for Grants & Co OS. Never sends messages.
 */

import { getGhlApiConfig } from "@/lib/integrations/credentials";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

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
    throw new GhlApiError("GHL_API_KEY is not configured", 503);
  }
  if (!config.locationId) {
    throw new GhlApiError("GHL_LOCATION_ID is not configured", 503);
  }
  return { apiKey: config.apiKey, locationId: config.locationId };
}

async function ghlFetch<T>(
  path: string,
  init: RequestInit & { query?: Record<string, string> } = {},
): Promise<T> {
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
