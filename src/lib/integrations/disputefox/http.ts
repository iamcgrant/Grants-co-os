/**
 * DisputeFox HTTP client — inbound read-only.
 *
 * There is no public DisputeFox client-list API used here.
 * Zap 374413762 stays OFF. This module never creates, updates, or deletes
 * DisputeFox records and never sends messages.
 *
 * Live calls fail closed without DISPUTEFOX_API_KEY (same pattern as GHL).
 * Do not regenerate the Fox API key.
 */

import { getDisputeFoxApiConfig } from "@/lib/integrations/credentials";
import {
  DISPUTEFOX_API_KEY_ENV,
  DISPUTEFOX_ZAP_ENABLED,
  DISPUTEFOX_ZAP_ID,
} from "./secrets";

/** Hard lock — this module must never grow client write helpers. */
export const DISPUTEFOX_CLIENT_WRITES_ENABLED = false;

/** Live list/get stays off so Zap 374413762 is never used as a write/sync bus. */
export const DISPUTEFOX_LIVE_LIST_ENABLED = false;

export type DisputeFoxApiClient = {
  /** Real DisputeFox numeric/string id only. Omit when unknown — never invent. */
  id?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  stage?: string | null;
  started?: boolean | null;
  // Future intake stamp fields (not wired this PR): campaignId, contentId, adId, cta.
  // Do not invent them. Missing stamp = DATA UNAVAILABLE, not organic.
};

export class DisputeFoxApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = "DisputeFoxApiError";
  }
}

function requireConfig() {
  const config = getDisputeFoxApiConfig();
  if (!config?.apiKey) {
    throw new DisputeFoxApiError(`${DISPUTEFOX_API_KEY_ENV} is not configured`, 503);
  }
  return config;
}

/**
 * Fail closed: refuse create/update/delete of DisputeFox clients.
 * No outbound messages. No Zap enablement.
 */
export function assertDisputeFoxInboundOnly(method: string, path: string) {
  if (DISPUTEFOX_CLIENT_WRITES_ENABLED) {
    throw new DisputeFoxApiError("DisputeFox client writes are disabled", 403);
  }
  if (DISPUTEFOX_ZAP_ENABLED) {
    throw new DisputeFoxApiError(`Zap ${DISPUTEFOX_ZAP_ID} must stay OFF`, 403);
  }
  const m = (method || "GET").toUpperCase();
  let pathname = path;
  try {
    pathname = path.startsWith("http") ? new URL(path).pathname : path;
  } catch {
    pathname = path;
  }
  if (m === "GET" && DISPUTEFOX_LIVE_LIST_ENABLED) return;
  if (m !== "GET") {
    throw new DisputeFoxApiError(
      "Inbound-only DisputeFox client refuses writes — will not create, update, or delete DisputeFox records",
      403,
    );
  }
  throw new DisputeFoxApiError(
    `Live DisputeFox list/get is not enabled. Zap ${DISPUTEFOX_ZAP_ID} stays OFF.`,
    403,
  );
}

export function isDisputeFoxApiReady(): boolean {
  return Boolean(getDisputeFoxApiConfig()?.apiKey);
}

/**
 * Live fetch is intentionally not implemented. Callers must fail closed
 * without a key, or use the checked-in local roster attach.
 */
export async function listDisputeFoxClients(): Promise<{
  clients: DisputeFoxApiClient[];
  total?: number;
}> {
  requireConfig();
  assertDisputeFoxInboundOnly("GET", "/clients");
  return { clients: [] };
}

export async function getDisputeFoxClient(_externalId: string): Promise<DisputeFoxApiClient> {
  requireConfig();
  assertDisputeFoxInboundOnly("GET", "/clients/id");
  throw new DisputeFoxApiError(
    `Live DisputeFox get is not enabled. Zap ${DISPUTEFOX_ZAP_ID} stays OFF.`,
    403,
  );
}
