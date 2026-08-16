/**
 * Catalog adapters — project existing OS / GHL / DF data shapes into the
 * CRC recovery compare catalog. Does not invent a second identity store.
 */

import { CONFIRMED_MASTERS, type ConfirmedMasterRow } from "@/lib/clients/confirmed-masters";
import { CONFIRMED_DF_ROSTER, type ConfirmedDfRow } from "@/lib/integrations/disputefox/roster";
import type { GhlApiContact } from "@/lib/integrations/ghl/http";
import type { DisputeFoxApiClient } from "@/lib/integrations/disputefox/http";
import type { DfCatalogClient, GhlCatalogContact, IdentityCatalog, OsMasterRecord } from "./types";

export function projectConfirmedMastersToOsCatalog(
  rows: ConfirmedMasterRow[] = CONFIRMED_MASTERS,
): OsMasterRecord[] {
  return rows.map((row, index) => ({
    grantsClientId: `GC-CONFIRMED-${String(index + 1).padStart(2, "0")}`,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    emailVerified: true,
    phone: row.phone ?? null,
    phoneVerified: Boolean(row.phone),
  }));
}

export function projectConfirmedDfRosterToDfCatalog(
  rows: ConfirmedDfRow[] = CONFIRMED_DF_ROSTER,
): DfCatalogClient[] {
  return rows.map((row) => ({
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    started: row.started,
    stage: row.dfStageLabel,
    // Do not invent DisputeFox numeric IDs.
    disputeFoxClientId: null,
  }));
}

export function projectGhlApiContact(contact: GhlApiContact): GhlCatalogContact {
  return {
    ghlContactId: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
  };
}

export function projectDisputeFoxApiClient(client: DisputeFoxApiClient): DfCatalogClient {
  return {
    disputeFoxClientId: client.id ?? null,
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    phone: client.phone,
    stage: client.stage,
    started: client.started ?? undefined,
  };
}

export function mergeCatalogs(...catalogs: IdentityCatalog[]): IdentityCatalog {
  return {
    osMasters: catalogs.flatMap((c) => c.osMasters),
    ghlContacts: catalogs.flatMap((c) => c.ghlContacts),
    dfClients: catalogs.flatMap((c) => c.dfClients),
  };
}

export function confirmedInboundShapeCatalog(): IdentityCatalog {
  return {
    osMasters: projectConfirmedMastersToOsCatalog(),
    ghlContacts: [],
    dfClients: projectConfirmedDfRosterToDfCatalog(),
  };
}
