/**
 * CRC → Grants inbound compare (existing master records only).
 *
 * Copies the DisputeFox inbound-attach shape (PR #8):
 * - Grants & Co OS is master identity (ONE HUMAN = ONE MASTER CLIENT RECORD)
 * - Match order: CRC id → email → normalized phone → name + corroborating address
 * - Never create Grants clients
 * - Never create/update/delete CRC / GHL / DisputeFox records
 * - Never send messages
 * - Fail closed without CRC_API_KEY on the live path
 * - CRC_RECOVERY_WRITES_ENABLED stays false
 */

import { prisma } from "@/lib/db/prisma";
import {
  normalizeAddressKey,
  normalizeEmail,
  normalizePersonName,
  normalizePhone,
} from "@/lib/clients/identity";
import { CLIENT_IDENTIFIER_PROVIDER } from "@/lib/clients/identifiers";
import { buildCrcRecoveryReport, type CrcRecoveryReport } from "@/lib/crc-recovery/report";
import { decideCrcExport } from "@/lib/crc-recovery/decisioning";
import { applyCrcRecoveryDecisions } from "@/lib/crc-recovery/writes";
import { CRC_DO_NOT_ENROLL, CRC_RECOVERY_LOCKS } from "@/lib/crc-recovery/locks";
import { SYNTHETIC_CRC_EXPORT, SYNTHETIC_NOW_MS, syntheticCatalog } from "@/lib/crc-recovery/synthetic";
import { loadCatalog } from "@/lib/crc-recovery/load";
import type { CrcExportClient, IdentityCatalog } from "@/lib/crc-recovery/types";
import {
  CRC_LIVE_LIST_ENABLED,
  CrcApiError,
  isCrcApiReady,
  type CrcApiClient,
} from "./http";
import { CRC_API_KEY_ENV, CRC_RECOVERY_WRITES_ENV, isCrcRecoveryWritesEnabled } from "./secrets";
import {
  CRC_LOCAL_ROSTER_TAG,
  defaultSyntheticCrcRosterPath,
  loadCrcRosterCsv,
  type CrcRosterRow,
} from "./roster";

export type CrcCompareAction = "MATCHED" | "SKIPPED_NO_MATCH" | "SKIPPED_AMBIGUOUS";

export type CrcMatchBy = "crc_id" | "email" | "phone" | "name_and_address";

export type CrcCompareResult = {
  action: CrcCompareAction;
  grantsClientId?: string;
  clientId?: string;
  crcClientId?: string;
  matchedBy?: CrcMatchBy;
  dryRun: true;
  createdClient: false;
  message?: string;
};

export type CrcCompareOptions = {
  dryRun?: boolean;
  actorId?: string;
};

type MatchedClient = {
  id: string;
  grantsClientId: string;
  email: string;
  emailNormalized: string;
  phone: string | null;
  phoneNormalized: string | null;
  firstName: string;
  lastName: string;
};

export function failClosedWithoutCrcKey(dryRun = false) {
  return {
    ready: false as const,
    dryRun,
    failedClosed: true as const,
    results: [] as CrcCompareResult[],
    fetched: 0,
    requiredSecrets: [CRC_API_KEY_ENV],
    writesEnabled: isCrcRecoveryWritesEnabled(),
    createdClients: 0,
    message: `Fail-closed: ${CRC_API_KEY_ENV} is not set. Add it to host/runtime secrets (never commit). Use local CSV compare. ${CRC_RECOVERY_WRITES_ENV} stays false.`,
  };
}

function rosterToExportClient(row: CrcRosterRow): CrcExportClient {
  const docs = (row.documentTypes || "")
    .split("|")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((documentType, i) => ({
      id: `${row.crcClientId}-doc-${i + 1}`,
      crcClientId: row.crcClientId,
      documentType,
      originalDate: row.lastReportAt?.slice(0, 10) || "2024-01-01",
      rawIncluded: false as const,
    }));

  return {
    crcClientId: row.crcClientId,
    grantsClientId: row.grantsClientId,
    ghlContactId: row.ghlContactId,
    disputeFoxClientId: row.disputeFoxClientId,
    smartCreditId: row.smartCreditId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    emailVerified: row.emailVerified,
    phone: row.phone,
    phoneVerified: row.phoneVerified,
    address:
      row.line1 || row.postalCode
        ? { line1: row.line1, city: row.city, state: row.state, postalCode: row.postalCode }
        : null,
    addressVerified: row.addressVerified,
    status: row.status,
    verifiedActive: row.verifiedActive,
    currentlyProcessing: row.currentlyProcessing,
    doNotReactivate: row.doNotReactivate,
    lastWorkedAt: row.lastWorkedAt,
    lastReportAt: row.lastReportAt,
    lastDisputeAt: row.lastDisputeAt,
    documents: docs.length ? docs : undefined,
  };
}

/**
 * Match order is strict: CRC id → email → normalized phone → name + address.
 * Never creates a Grants Client.
 */
export async function matchExistingGrantsClientForCrc(
  contact: CrcRosterRow | CrcApiClient | CrcExportClient,
): Promise<
  | { client: MatchedClient; matchedBy: CrcMatchBy }
  | { client: null; matchedBy: null; skip: "NO_MATCH" | "AMBIGUOUS" | "INVALID" }
> {
  const crcId =
    ("crcClientId" in contact ? contact.crcClientId : contact.id)?.trim() || "";

  if (crcId) {
    const existingIdent = await prisma.clientIdentifier.findUnique({
      where: {
        provider_externalId: {
          provider: CLIENT_IDENTIFIER_PROVIDER.CREDIT_REPAIR_CLOUD,
          externalId: crcId,
        },
      },
      include: { client: true },
    });
    if (existingIdent) {
      return { client: existingIdent.client, matchedBy: "crc_id" };
    }
  }

  const emailNormalized = contact.email?.trim() ? normalizeEmail(contact.email) : null;
  if (emailNormalized) {
    const byEmail = await prisma.client.findUnique({
      where: { emailNormalized },
    });
    if (byEmail) {
      return { client: byEmail, matchedBy: "email" };
    }
  }

  const phoneNormalized = normalizePhone(contact.phone);
  if (phoneNormalized) {
    const byPhone = await prisma.client.findMany({
      where: { phoneNormalized },
    });
    if (byPhone.length > 1) {
      return { client: null, matchedBy: null, skip: "AMBIGUOUS" };
    }
    if (byPhone.length === 1) {
      return { client: byPhone[0], matchedBy: "phone" };
    }
  }

  const firstName = "firstName" in contact ? contact.firstName : null;
  const lastName = "lastName" in contact ? contact.lastName : null;
  const name = normalizePersonName(firstName, lastName);
  const addressKey = normalizeAddressKey(
    "address" in contact && contact.address
      ? contact.address
      : {
          line1: "line1" in contact ? contact.line1 : null,
          city: "city" in contact ? contact.city : null,
          state: "state" in contact ? contact.state : null,
          postalCode: "postalCode" in contact ? contact.postalCode : null,
        },
  );
  if (name && addressKey) {
    const candidates = await prisma.client.findMany({
      where: {
        firstName: { equals: (firstName || "").trim() },
        lastName: { equals: (lastName || "").trim() },
      },
      include: { addresses: true },
    });
    const hits = candidates.filter((c) => {
      if (normalizePersonName(c.firstName, c.lastName) !== name) return false;
      return c.addresses.some((a) => normalizeAddressKey(a) === addressKey);
    });
    if (hits.length > 1) {
      return { client: null, matchedBy: null, skip: "AMBIGUOUS" };
    }
    if (hits.length === 1) {
      return { client: hits[0], matchedBy: "name_and_address" };
    }
  }

  if (!crcId && !emailNormalized && !phoneNormalized && !(name && addressKey)) {
    return { client: null, matchedBy: null, skip: "INVALID" };
  }
  return { client: null, matchedBy: null, skip: "NO_MATCH" };
}

/**
 * Compare one CRC row onto an existing Grants master. Dry-run only.
 * Does not create Grants clients. Does not write CRC / GHL / DisputeFox.
 */
export async function compareCrcRowToGrants(
  contact: CrcRosterRow | CrcApiClient | CrcExportClient,
  options?: CrcCompareOptions,
): Promise<CrcCompareResult> {
  void options;
  const crcId =
    ("crcClientId" in contact ? contact.crcClientId : contact.id)?.trim() || "";

  const match = await matchExistingGrantsClientForCrc(contact);
  if (!match.client) {
    const action: CrcCompareAction =
      match.skip === "AMBIGUOUS" ? "SKIPPED_AMBIGUOUS" : "SKIPPED_NO_MATCH";
    const message =
      match.skip === "INVALID"
        ? "Missing CRC id, email, phone, and name+address — not created"
        : match.skip === "AMBIGUOUS"
          ? "Multiple Grants clients matched — resolve manually before linking"
          : "No existing Grants master client matched CRC id, email, phone, or name+address — not created";
    return {
      action,
      crcClientId: crcId || undefined,
      dryRun: true,
      createdClient: false,
      message,
    };
  }

  return {
    action: "MATCHED",
    grantsClientId: match.client.grantsClientId,
    clientId: match.client.id,
    crcClientId: crcId || undefined,
    matchedBy: match.matchedBy,
    dryRun: true,
    createdClient: false,
    message: `Dry-run: would attach CRC identifier on ${match.client.grantsClientId} via ${match.matchedBy}`,
  };
}

export async function compareLocalCrcRoster(input?: {
  csvPath?: string;
  osPath?: string;
  ghlPath?: string;
  dfPath?: string;
  catalog?: IdentityCatalog;
  nowMs?: number;
}): Promise<{
  ready: true;
  dryRun: true;
  local: true;
  roster: number;
  results: CrcCompareResult[];
  matched: number;
  skipped: number;
  createdClients: 0;
  writesEnabled: false;
  zapEnabled: false;
  report: CrcRecoveryReport;
  applyRefused: true;
  enroll: typeof CRC_DO_NOT_ENROLL;
  locks: typeof CRC_RECOVERY_LOCKS;
  message: string;
}> {
  const csvPath = input?.csvPath || defaultSyntheticCrcRosterPath();
  const rows = loadCrcRosterCsv(csvPath);
  const clients = rows.map(rosterToExportClient);
  const withDocs = clients.map((c) => {
    const fromJson = SYNTHETIC_CRC_EXPORT.clients.find((j) => j.crcClientId === c.crcClientId);
    return fromJson?.documents?.length ? { ...c, documents: fromJson.documents } : c;
  });

  const catalog =
    input?.catalog ||
    loadCatalog({
      osPath: input?.osPath,
      ghlPath: input?.ghlPath,
      dfPath: input?.dfPath,
    }) ||
    syntheticCatalog();

  const report = buildCrcRecoveryReport({
    crcClients: withDocs,
    catalog,
    nowMs: input?.nowMs ?? SYNTHETIC_NOW_MS,
  });

  const decisions = decideCrcExport(withDocs, catalog, input?.nowMs ?? SYNTHETIC_NOW_MS);
  const apply = applyCrcRecoveryDecisions(decisions);

  const results: CrcCompareResult[] = decisions.map((d) => {
    if (d.resolution.unified === "AMBIGUOUS") {
      return {
        action: "SKIPPED_AMBIGUOUS",
        crcClientId: d.crcClientId,
        grantsClientId: d.resolution.grantsClientId,
        dryRun: true,
        createdClient: false,
        message: d.resolution.unifiedReason,
      };
    }
    if (d.resolution.os.status === "MATCHED") {
      return {
        action: "MATCHED",
        crcClientId: d.crcClientId,
        grantsClientId: d.resolution.grantsClientId,
        matchedBy: d.resolution.os.hits[0].matchedBy === "provider_id"
          ? "crc_id"
          : d.resolution.os.hits[0].matchedBy,
        dryRun: true,
        createdClient: false,
      };
    }
    return {
      action: "SKIPPED_NO_MATCH",
      crcClientId: d.crcClientId,
      dryRun: true,
      createdClient: false,
      message: "No existing Grants master — not created",
    };
  });

  const matched = results.filter((r) => r.action === "MATCHED").length;
  const skipped = results.length - matched;

  return {
    ready: true,
    dryRun: true,
    local: true,
    roster: rows.length,
    results,
    matched,
    skipped,
    createdClients: 0,
    writesEnabled: false,
    zapEnabled: false,
    report,
    applyRefused: apply.refused,
    enroll: CRC_DO_NOT_ENROLL,
    locks: CRC_RECOVERY_LOCKS,
    message: `${CRC_LOCAL_ROSTER_TAG}. Dry-run existing-only compare. No CRC/GHL/DF/OS creates. ${CRC_RECOVERY_WRITES_ENV} stays false. Zap 374413762 stays OFF.`,
  };
}

/**
 * Live pull. Without CRC_API_KEY this fails closed (no HTTP, no client writes).
 * With a key, live list stays disabled — use local CSV compare.
 */
export async function pullCrcClients(input: {
  dryRun?: boolean;
}): Promise<{
  ready: boolean;
  dryRun: boolean;
  failedClosed?: boolean;
  results: CrcCompareResult[];
  fetched: number;
  message?: string;
  requiredSecrets?: string[];
  writesEnabled: boolean;
  liveListEnabled: false;
  createdClients: 0;
}> {
  const dryRun = Boolean(input.dryRun);

  if (!isCrcApiReady()) {
    return failClosedWithoutCrcKey(dryRun);
  }

  if (!CRC_LIVE_LIST_ENABLED) {
    return {
      ready: true,
      dryRun,
      results: [],
      fetched: 0,
      writesEnabled: isCrcRecoveryWritesEnabled(),
      liveListEnabled: false,
      createdClients: 0,
      message: `Live CRC list is not enabled. ${CRC_API_KEY_ENV} present but unused. Use local CSV compare. No CRC writes. ${CRC_RECOVERY_WRITES_ENV} stays false.`,
    };
  }

  throw new CrcApiError("Live CRC list must stay disabled", 403);
}
