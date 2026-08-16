/**
 * Credit Repair Cloud HTTP client — inbound compare only.
 *
 * Live calls fail closed without CRC_API_KEY (same pattern as DisputeFox).
 * This module never creates, updates, or deletes CRC / GHL / DisputeFox records
 * and never sends messages. CRC_RECOVERY_WRITES_ENABLED stays false.
 */

import { CRC_API_KEY_ENV, isCrcRecoveryWritesEnabled } from "./secrets";

/** Hard lock — this module must never grow client write helpers. */
export const CRC_CLIENT_WRITES_ENABLED = false;

/** Live list/get stays off. No real CRC export on this box. */
export const CRC_LIVE_LIST_ENABLED = false;

export type CrcApiClient = {
  id?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
};

export class CrcApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = "CrcApiError";
  }
}

export function getCrcApiConfig(): { apiKey: string } | null {
  const apiKey = process.env[CRC_API_KEY_ENV]?.trim();
  if (!apiKey) return null;
  return { apiKey };
}

export function isCrcApiReady(): boolean {
  return Boolean(getCrcApiConfig()?.apiKey);
}

function requireConfig() {
  const config = getCrcApiConfig();
  if (!config?.apiKey) {
    throw new CrcApiError(`${CRC_API_KEY_ENV} is not configured`, 503);
  }
  return config;
}

/**
 * Fail closed: refuse create/update/delete of CRC clients.
 * No outbound messages. No live list without an explicit later enablement.
 */
export function assertCrcInboundOnly(method: string, path: string) {
  if (CRC_CLIENT_WRITES_ENABLED || isCrcRecoveryWritesEnabled()) {
    throw new CrcApiError("CRC client writes are disabled", 403);
  }
  const m = (method || "GET").toUpperCase();
  let pathname = path;
  try {
    pathname = path.startsWith("http") ? new URL(path).pathname : path;
  } catch {
    pathname = path;
  }
  void pathname;
  if (m === "GET" && CRC_LIVE_LIST_ENABLED) return;
  if (m !== "GET") {
    throw new CrcApiError(
      "Inbound-only CRC client refuses writes — will not create, update, or delete CRC records",
      403,
    );
  }
  throw new CrcApiError(
    `Live CRC list/get is not enabled. ${CRC_API_KEY_ENV} fail-closed. Use local CSV compare.`,
    403,
  );
}

/**
 * Live fetch is intentionally not implemented. Callers must fail closed
 * without a key, or use the checked-in synthetic CSV roster.
 */
export async function listCrcClients(): Promise<{ clients: CrcApiClient[]; total?: number }> {
  requireConfig();
  assertCrcInboundOnly("GET", "/clients");
  return { clients: [] };
}

export async function getCrcClient(_externalId: string): Promise<CrcApiClient> {
  requireConfig();
  assertCrcInboundOnly("GET", "/clients/id");
  throw new CrcApiError(
    `Live CRC get is not enabled. ${CRC_API_KEY_ENV} fail-closed. Use local CSV compare.`,
    403,
  );
}
