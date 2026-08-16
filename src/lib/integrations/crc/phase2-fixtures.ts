/**
 * Synthetic Phase 2 cases. No real client PII.
 * Real CRC exports stay in local/crc-exports/ (gitignored).
 */

import type { CrcExportClient, IdentityCatalog } from "@/lib/crc-recovery/types";
import { SYNTHETIC_NOW_MS } from "@/lib/crc-recovery/synthetic";
import { CRC_CHARLES_AOL_EMAIL } from "./identity-locks";
import { CMI_CLUSTER_ID } from "./queues";

export const PHASE2_SYNTHETIC_NOW_MS = SYNTHETIC_NOW_MS;

export const PHASE2_SYNTHETIC_CLIENTS: CrcExportClient[] = [
  {
    crcClientId: "CRC-SYN-P2-ACTIVE",
    grantsClientId: "GC-SYN-P2-0001",
    ghlContactId: "ghl_syn_p2_active",
    disputeFoxClientId: "df_syn_p2_active",
    firstName: "Pat",
    lastName: "Active",
    email: "pat.active@example.test",
    emailVerified: true,
    phone: "5550102001",
    phoneVerified: true,
    status: "verified_active",
    verifiedActive: true,
    currentlyProcessing: true,
    lastWorkedAt: "2026-08-12T00:00:00.000Z",
    lastDisputeAt: "2026-08-11T00:00:00.000Z",
    lastReportAt: "2026-08-10T00:00:00.000Z",
    lastNoteAt: "2026-08-12T12:00:00.000Z",
    lastPaymentAt: "2026-08-01T00:00:00.000Z",
  },
  {
    crcClientId: "CRC-SYN-P2-STARTED",
    firstName: "Sam",
    lastName: "Starter",
    email: "sam.starter@example.test",
    emailVerified: true,
    status: "active",
    startedAt: "2026-08-01T00:00:00.000Z",
  },
  {
    crcClientId: "CRC-SYN-P2-RECENT-DF",
    firstName: "Client72",
    lastName: "Review",
    email: "client72.review@example.test",
    emailVerified: true,
    status: "active",
    currentlyProcessing: true,
    lastWorkedAt: "2026-08-08T00:00:00.000Z",
    crcClientStar: true,
  },
  {
    crcClientId: "CRC-SYN-P2-CMI",
    firstName: "Client14",
    lastName: "Cluster",
    email: "client14.cluster@example.test",
    emailVerified: true,
    status: "active",
    lastWorkedAt: "2026-03-10T15:00:00.000Z",
    lastDisputeAt: "2026-03-10T16:00:00.000Z",
    cluster: CMI_CLUSTER_ID,
    crcClientStar: true,
  },
  {
    crcClientId: "CRC-SYN-P2-STAR",
    firstName: "Client8",
    lastName: "Unmatched",
    email: "client8.unmatched@example.test",
    emailVerified: true,
    status: "inactive",
    lastWorkedAt: "2024-01-01T00:00:00.000Z",
    crcClientStar: true,
  },
  {
    crcClientId: "CRC-SYN-P2-DORMANT",
    firstName: "Drew",
    lastName: "Dormant",
    email: "drew.dormant@example.test",
    emailVerified: true,
    status: "inactive",
    lastWorkedAt: "2023-01-01T00:00:00.000Z",
  },
  {
    crcClientId: "CRC-SYN-P2-CLOSED",
    firstName: "Chris",
    lastName: "Closed",
    email: "chris.closed@example.test",
    emailVerified: true,
    status: "closed",
    doNotReactivate: true,
    lastWorkedAt: "2021-01-01T00:00:00.000Z",
  },
  {
    crcClientId: "CRC-SYN-P2-LOCK-KB",
    firstName: "Kimberly",
    lastName: "Britt",
    email: "lock.kimberly-britt@example.test",
    emailVerified: true,
    status: "inactive",
  },
  {
    crcClientId: "CRC-SYN-P2-AOL",
    firstName: "Charles",
    lastName: "Grant",
    email: CRC_CHARLES_AOL_EMAIL,
    emailVerified: true,
    status: "inactive",
  },
  {
    crcClientId: "CRC-SYN-P2-ENRICH",
    grantsClientId: "GC-SYN-P2-0009",
    firstName: "Eden",
    lastName: "Enrich",
    email: "eden.enrich.old@example.test",
    emailVerified: true,
    emailVerifiedAt: "2023-01-01T00:00:00.000Z",
    phone: "5550102009",
    phoneVerified: true,
    status: "inactive",
    lastWorkedAt: "2024-01-01T00:00:00.000Z",
  },
];

export const PHASE2_SYNTHETIC_CATALOG: IdentityCatalog = {
  osMasters: [
    {
      grantsClientId: "GC-SYN-P2-0001",
      firstName: "Pat",
      lastName: "Active",
      email: "pat.active@example.test",
      emailVerified: true,
      phone: "5550102001",
      phoneVerified: true,
      crcClientId: "CRC-SYN-P2-ACTIVE",
      ghlContactId: "ghl_syn_p2_active",
      disputeFoxClientId: "df_syn_p2_active",
    },
    {
      grantsClientId: "GC-SYN-P2-0009",
      firstName: "Eden",
      lastName: "Enrich",
      email: "eden.enrich@example.test",
      emailVerified: true,
      emailVerifiedAt: "2026-06-01T00:00:00.000Z",
      phone: null,
    },
  ],
  ghlContacts: [
    {
      ghlContactId: "ghl_syn_p2_active",
      firstName: "Pat",
      lastName: "Active",
      email: "pat.active@example.test",
      grantsClientId: "GC-SYN-P2-0001",
      crcClientId: "CRC-SYN-P2-ACTIVE",
    },
  ],
  dfClients: [
    {
      disputeFoxClientId: "df_syn_p2_active",
      firstName: "Pat",
      lastName: "Active",
      email: "pat.active@example.test",
      grantsClientId: "GC-SYN-P2-0001",
      crcClientId: "CRC-SYN-P2-ACTIVE",
      started: true,
    },
  ],
};

export function phase2SyntheticCatalog(): IdentityCatalog {
  return {
    osMasters: [...PHASE2_SYNTHETIC_CATALOG.osMasters],
    ghlContacts: [...PHASE2_SYNTHETIC_CATALOG.ghlContacts],
    dfClients: [...PHASE2_SYNTHETIC_CATALOG.dfClients],
  };
}
