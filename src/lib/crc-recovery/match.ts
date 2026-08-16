/**
 * CRC identity match — extends Grants OS identity helpers.
 *
 * Order (strict):
 *  1. provider / client IDs
 *  2. exact email (normalized)
 *  3. normalized phone
 *  4. name + corroborating address (or other reliable info)
 *
 * Name alone is never enough. Multiple hits at the current step → AMBIGUOUS.
 */

import {
  normalizeAddressKey,
  normalizeEmail,
  normalizePersonName,
  normalizePhone,
} from "@/lib/clients/identity";
import { collectProviderIds, type MasterIdentityIds } from "@/lib/clients/identifiers";
import type {
  CrcExportClient,
  DfCatalogClient,
  GhlCatalogContact,
  MatchBy,
  MatchHit,
  OsMasterRecord,
  SystemMatch,
} from "./types";

function idsOf(record: MasterIdentityIds): Map<string, string> {
  const map = new Map<string, string>();
  for (const id of collectProviderIds(record)) {
    map.set(`${id.provider}:${id.externalId}`, id.externalId);
  }
  return map;
}

function crcIds(client: CrcExportClient): MasterIdentityIds {
  return {
    grantsClientId: client.grantsClientId,
    ghlContactId: client.ghlContactId,
    disputeFoxClientId: client.disputeFoxClientId,
    crcClientId: client.crcClientId,
    smartCreditId: client.smartCreditId,
  };
}

function recordIds(record: MasterIdentityIds): MasterIdentityIds {
  return record;
}

function providerIdHits<T extends MasterIdentityIds>(
  crc: CrcExportClient,
  records: T[],
): MatchHit<T>[] {
  const source = idsOf(crcIds(crc));
  if (source.size === 0) return [];
  const hits: MatchHit<T>[] = [];
  for (const record of records) {
    const target = idsOf(recordIds(record));
    for (const key of source.keys()) {
      if (target.has(key)) {
        const [provider] = key.split(":");
        hits.push({ record, matchedBy: "provider_id", provider });
        break;
      }
    }
  }
  return uniqueHits(hits);
}

function emailOf(record: { email?: string | null }): string | null {
  return record.email?.trim() ? normalizeEmail(record.email) : null;
}

function phoneOf(record: { phone?: string | null }): string | null {
  return normalizePhone(record.phone);
}

function nameOf(record: { firstName?: string | null; lastName?: string | null }): string | null {
  return normalizePersonName(record.firstName, record.lastName);
}

function addressOf(record: { address?: Parameters<typeof normalizeAddressKey>[0] }): string | null {
  return normalizeAddressKey(record.address);
}

function uniqueHits<T>(hits: MatchHit<T>[]): MatchHit<T>[] {
  const seen = new Set<T>();
  const out: MatchHit<T>[] = [];
  for (const hit of hits) {
    if (seen.has(hit.record)) continue;
    seen.add(hit.record);
    out.push(hit);
  }
  return out;
}

function finish<T>(hits: MatchHit<T>[], ambiguousReason: string): SystemMatch<T> {
  if (hits.length === 1) return { status: "MATCHED", hits: [hits[0]] };
  if (hits.length > 1) return { status: "AMBIGUOUS", hits, reason: ambiguousReason };
  return { status: "MISSING" };
}

export function matchRecords<T extends MasterIdentityIds & {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  address?: Parameters<typeof normalizeAddressKey>[0];
}>(crc: CrcExportClient, records: T[]): SystemMatch<T> {
  const byId = providerIdHits(crc, records);
  if (byId.length > 0) {
    return finish(byId, "Multiple catalog records share a provider/client ID with this CRC client");
  }

  const crcEmail = emailOf(crc);
  if (crcEmail) {
    const byEmail: MatchHit<T>[] = records
      .filter((r) => emailOf(r) === crcEmail)
      .map((record) => ({ record, matchedBy: "email" as MatchBy }));
    if (byEmail.length > 0) {
      return finish(byEmail, "Multiple catalog records share this exact email");
    }
  }

  const crcPhone = phoneOf(crc);
  if (crcPhone) {
    const byPhone: MatchHit<T>[] = records
      .filter((r) => phoneOf(r) === crcPhone)
      .map((record) => ({ record, matchedBy: "phone" as MatchBy }));
    if (byPhone.length > 0) {
      return finish(byPhone, "Multiple catalog records share this normalized phone");
    }
  }

  const crcName = nameOf(crc);
  const crcAddress = addressOf(crc);
  if (crcName && crcAddress) {
    const byNameAddress: MatchHit<T>[] = records
      .filter((r) => nameOf(r) === crcName && addressOf(r) === crcAddress)
      .map((record) => ({ record, matchedBy: "name_and_address" as MatchBy }));
    if (byNameAddress.length > 0) {
      return finish(
        byNameAddress,
        "Multiple catalog records share this name and corroborating address",
      );
    }
  }

  return { status: "MISSING" };
}

export function matchOs(crc: CrcExportClient, masters: OsMasterRecord[]) {
  return matchRecords(crc, masters);
}

export function matchGhl(crc: CrcExportClient, contacts: GhlCatalogContact[]) {
  return matchRecords(crc, contacts);
}

export function matchDf(crc: CrcExportClient, clients: DfCatalogClient[]) {
  return matchRecords(crc, clients);
}

function grantsIdFrom<T extends { grantsClientId?: string | null }>(
  match: SystemMatch<T>,
): string | undefined {
  if (match.status !== "MATCHED") return undefined;
  return match.hits[0].record.grantsClientId?.trim() || undefined;
}

/**
 * Search Grants OS + GHL + DisputeFox before any future create.
 * Conflicting distinct humans across systems → AMBIGUOUS.
 */
export function resolveCrcIdentity(
  crc: CrcExportClient,
  catalog: {
    osMasters: OsMasterRecord[];
    ghlContacts: GhlCatalogContact[];
    dfClients: DfCatalogClient[];
  },
  classification: import("./classification").CrcClientClassification,
): import("./types").CrcIdentityResolution {
  const os = matchOs(crc, catalog.osMasters);
  const ghl = matchGhl(crc, catalog.ghlContacts);
  const df = matchDf(crc, catalog.dfClients);

  const grantsIds = new Set<string>();
  for (const id of [grantsIdFrom(os), grantsIdFrom(ghl), grantsIdFrom(df)]) {
    if (id) grantsIds.add(id);
  }

  if (os.status === "AMBIGUOUS" || ghl.status === "AMBIGUOUS" || df.status === "AMBIGUOUS") {
    const reason =
      os.status === "AMBIGUOUS"
        ? os.reason
        : ghl.status === "AMBIGUOUS"
          ? ghl.reason
          : (df as { reason: string }).reason;
    return {
      crcClientId: crc.crcClientId,
      classification,
      os,
      ghl,
      df,
      unified: "AMBIGUOUS",
      unifiedReason: reason,
    };
  }

  if (grantsIds.size > 1) {
    return {
      crcClientId: crc.crcClientId,
      classification,
      os,
      ghl,
      df,
      unified: "AMBIGUOUS",
      unifiedReason: "OS / GHL / DisputeFox matches point at different Grants Client IDs",
    };
  }

  const anyMatch = os.status === "MATCHED" || ghl.status === "MATCHED" || df.status === "MATCHED";
  if (anyMatch) {
    return {
      crcClientId: crc.crcClientId,
      classification,
      os,
      ghl,
      df,
      unified: "MATCHED",
      unifiedReason: "Matched an existing human in Grants OS, GHL, and/or DisputeFox",
      grantsClientId: [...grantsIds][0] || (os.status === "MATCHED" ? os.hits[0].record.grantsClientId : undefined),
    };
  }

  return {
    crcClientId: crc.crcClientId,
    classification,
    os,
    ghl,
    df,
    unified: "MISSING",
    unifiedReason: "No Grants OS, GHL, or DisputeFox match — future path is one Grants master + one GHL contact",
  };
}
