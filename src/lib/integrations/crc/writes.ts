/**
 * Phase 2 class-gated write planner. Dry-run / scaffolding only.
 *
 * Never creates live Grants, GHL, DisputeFox, or CRC records.
 * Never sends messages. Never publishes workflows.
 * Never a single global write-everything path.
 */

import { decideFieldBackfill } from "@/lib/crc-recovery/backfill";
import { CRC_DO_NOT_ENROLL, CRC_MIGRATION_SOURCE } from "@/lib/crc-recovery/locks";
import type {
  BackfillDecision,
  BackfillField,
  CrcDocumentRef,
  CrcExportClient,
  OsMasterRecord,
} from "@/lib/crc-recovery/types";
import { decideIdentityLock } from "./identity-locks";
import { CrcPhase2Classification, type CrcPhase2Classification as Phase2Class } from "./phase2-classification";
import { CrcPhase2Queue } from "./queues";
import {
  CRC_PHASE2_BULK_GHL_CREATE_ENABLED,
  CRC_PHASE2_LIVE_CLIENTS_ENABLED,
  CRC_WRITE_ACTIVE_CONTINUITY_ENV,
  CRC_WRITE_DF_CREATE_ENV,
  CRC_WRITE_DOCUMENTS_ENV,
  CRC_WRITE_DORMANT_GHL_ORG_ENV,
  CRC_WRITE_ENRICHMENT_ENV,
  CRC_WRITE_FLAG_ENV_BY_NAME,
  describeCrcWriteFlags,
  isCrcWriteFlagEnabled,
  type CrcWriteFlagName,
} from "./write-flags";

export type Phase2WriteKind =
  | "enrichment"
  | "active_continuity_link"
  | "dormant_ghl_org"
  | "documents"
  | "df_create"
  | "ghl_create"
  | "os_create"
  | "merge"
  | "message"
  | "workflow"
  | "enrollment"
  | "welcome"
  | "friday";

export type Phase2WriteDecision = {
  ok: boolean;
  refused: boolean;
  kind: Phase2WriteKind;
  flag: string | null;
  flagEnabled: boolean;
  classification?: Phase2Class;
  reason: string;
  wouldExecute: false;
  executed: false;
  liveCreates: 0;
  dfCreates: 0;
  ghlCreates: 0;
  osCreates: 0;
  messagesSent: 0;
  workflowsPublished: 0;
  enrollments: 0;
  exactlyOne?: boolean;
  sourceSystem?: typeof CRC_MIGRATION_SOURCE;
};

const ZERO_EFFECTS = {
  wouldExecute: false as const,
  executed: false as const,
  liveCreates: 0 as const,
  dfCreates: 0 as const,
  ghlCreates: 0 as const,
  osCreates: 0 as const,
  messagesSent: 0 as const,
  workflowsPublished: 0 as const,
  enrollments: 0 as const,
};

function refuse(
  kind: Phase2WriteKind,
  reason: string,
  extra?: Partial<Phase2WriteDecision>,
): Phase2WriteDecision {
  return {
    ok: false,
    refused: true,
    kind,
    flag: extra?.flag ?? null,
    flagEnabled: extra?.flagEnabled ?? false,
    classification: extra?.classification,
    reason,
    ...ZERO_EFFECTS,
    exactlyOne: extra?.exactlyOne,
    sourceSystem: extra?.sourceSystem,
  };
}

function planOk(
  kind: Phase2WriteKind,
  reason: string,
  extra?: Partial<Phase2WriteDecision>,
): Phase2WriteDecision {
  return {
    ok: true,
    refused: false,
    kind,
    flag: extra?.flag ?? null,
    flagEnabled: extra?.flagEnabled ?? false,
    classification: extra?.classification,
    reason,
    ...ZERO_EFFECTS,
    exactlyOne: extra?.exactlyOne,
    sourceSystem: extra?.sourceSystem,
  };
}

function flagState(name: CrcWriteFlagName): { flag: string; flagEnabled: boolean } {
  return {
    flag: CRC_WRITE_FLAG_ENV_BY_NAME[name],
    flagEnabled: isCrcWriteFlagEnabled(name),
  };
}

export type Phase2WriteContext = {
  client: CrcExportClient;
  classification: Phase2Class;
  missingFromDf?: boolean;
  missingFromGhl?: boolean;
  missingFromOs?: boolean;
  ambiguous?: boolean;
  unmatchedCrcClientStar?: boolean;
  queues?: string[];
  osMaster?: OsMasterRecord | null;
};

function lockOrRefuse(kind: Phase2WriteKind, ctx: Phase2WriteContext): Phase2WriteDecision | null {
  const lock = decideIdentityLock({
    firstName: ctx.client.firstName,
    lastName: ctx.client.lastName,
    email: ctx.client.email,
  });
  if (lock.lockId === "charles-aol-refused") {
    return refuse(kind, lock.reason, { classification: ctx.classification });
  }
  if (lock.skipMerge && (kind === "merge" || kind === "os_create" || kind === "ghl_create" || kind === "df_create")) {
    return refuse(kind, lock.reason, { classification: ctx.classification });
  }
  return null;
}

export function planPhase2Write(kind: Phase2WriteKind, ctx: Phase2WriteContext): Phase2WriteDecision {
  const locked = lockOrRefuse(kind, ctx);
  if (locked) return locked;

  if (
    kind === "message" ||
    kind === "workflow" ||
    kind === "enrollment" ||
    kind === "welcome" ||
    kind === "friday"
  ) {
    return refuse(
      kind,
      "Comms/enrollment freeze: zero welcome, onboarding, POA, Friday Pulse, invoices, payment requests, outbound messages, or workflow publish. Zap 374413762 stays OFF.",
      { classification: ctx.classification },
    );
  }

  if (kind === "merge") {
    return refuse(kind, "Auto-merge is disabled. Do-not-merge identities stay skipped.", {
      classification: ctx.classification,
    });
  }

  if (kind === "os_create") {
    return refuse(kind, "Phase 2 scaffolding does not create Grants OS clients.", {
      classification: ctx.classification,
    });
  }

  if (kind === "ghl_create") {
    if (ctx.unmatchedCrcClientStar || ctx.queues?.includes(CrcPhase2Queue.UNMATCHED_CRC_CLIENT_STAR)) {
      return refuse(kind, "Do not bulk-create unmatched CRC Client* in GHL.", {
        classification: ctx.classification,
      });
    }
    return refuse(kind, "Live GHL contact create is refused. No GHL client in this PR.", {
      classification: ctx.classification,
    });
  }

  if (kind === "df_create") {
    return planDfCreate(ctx);
  }

  if (kind === "enrichment") {
    return refuse(kind, "Call planPhase2Enrichment with a field — class-gated blank-fill only.", {
      ...flagState("enrichment"),
      classification: ctx.classification,
    });
  }

  if (kind === "active_continuity_link") {
    const flags = flagState("activeContinuity");
    if (ctx.classification !== CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE) {
      return refuse(
        kind,
        "Active continuity links require CONFIRMED_CONTINUITY_ACTIVE. Do not mark Active from start date alone.",
        { ...flags, classification: ctx.classification },
      );
    }
    if (!flags.flagEnabled) {
      return refuse(kind, `${CRC_WRITE_ACTIVE_CONTINUITY_ENV} is not true. Default fail-closed.`, {
        ...flags,
        classification: ctx.classification,
      });
    }
    return planOk(
      kind,
      "Would link one master Grants↔GHL↔DF↔CRC. Not executed. Enrich blanks only; never overwrite newer verified data.",
      { ...flags, classification: ctx.classification, exactlyOne: true },
    );
  }

  if (kind === "dormant_ghl_org") {
    const flags = flagState("dormantGhlOrg");
    if (ctx.classification !== CrcPhase2Classification.DORMANT_REACTIVATION) {
      return refuse(kind, "Dormant GHL org writes are class-gated to DORMANT_REACTIVATION.", {
        ...flags,
        classification: ctx.classification,
      });
    }
    if (!flags.flagEnabled) {
      return refuse(kind, `${CRC_WRITE_DORMANT_GHL_ORG_ENV} is not true. Default fail-closed.`, {
        ...flags,
        classification: ctx.classification,
      });
    }
    return planOk(kind, "Would stamp GHL service-status schema only. No live GHL write in this PR.", {
      ...flags,
      classification: ctx.classification,
    });
  }

  if (kind === "documents") {
    const flags = flagState("documents");
    if (!flags.flagEnabled) {
      return refuse(kind, `${CRC_WRITE_DOCUMENTS_ENV} is not true. Default fail-closed.`, {
        ...flags,
        classification: ctx.classification,
        sourceSystem: CRC_MIGRATION_SOURCE,
      });
    }
    return planOk(
      kind,
      "Would recover document metadata only (sourceSystem=CREDIT_REPAIR_CLOUD). Raw files never GitHub.",
      { ...flags, classification: ctx.classification, sourceSystem: CRC_MIGRATION_SOURCE },
    );
  }

  return refuse(kind, "Unknown Phase 2 write kind — refused.", { classification: ctx.classification });
}

export function planDfCreate(ctx: Phase2WriteContext): Phase2WriteDecision {
  const flags = flagState("dfCreate");
  const locked = lockOrRefuse("df_create", ctx);
  if (locked) return locked;

  if (ctx.ambiguous) {
    return refuse("df_create", "Ambiguous identity — DF create refused.", {
      ...flags,
      classification: ctx.classification,
    });
  }

  if (ctx.classification !== CrcPhase2Classification.CONFIRMED_CONTINUITY_ACTIVE) {
    return refuse(
      "df_create",
      "DF create refused unless CONFIRMED_CONTINUITY_ACTIVE. The DF-missing Client* rows are a recovery queue, not auto-DF-create.",
      { ...flags, classification: ctx.classification },
    );
  }

  if (!flags.flagEnabled) {
    return refuse("df_create", `${CRC_WRITE_DF_CREATE_ENV} is not true. Strictest class-gated flag. Default fail-closed.`, {
      ...flags,
      classification: ctx.classification,
    });
  }

  if (ctx.missingFromDf === false) {
    return refuse("df_create", "DisputeFox record already present — do not create another file.", {
      ...flags,
      classification: ctx.classification,
    });
  }

  if (CRC_PHASE2_LIVE_CLIENTS_ENABLED) {
    return refuse("df_create", "Live DF clients are disabled in this PR.", {
      ...flags,
      classification: ctx.classification,
    });
  }

  return planOk(
    "df_create",
    "Continuity confirmed and DF create flag on — would create exactly one DisputeFox file later. Not executed in this PR.",
    { ...flags, classification: ctx.classification, exactlyOne: true },
  );
}

export function planPhase2Enrichment(input: {
  field: BackfillField;
  os: OsMasterRecord | null;
  crc: CrcExportClient;
  classification: Phase2Class;
}): Phase2WriteDecision & { backfill: BackfillDecision } {
  const flags = flagState("enrichment");
  const backfill = decideFieldBackfill(input.field, input.os, input.crc);
  const base = { ...flags, classification: input.classification };

  if (backfill.action === "CONFLICT_REVIEW" || backfill.action === "SKIP_ALREADY_PRESENT") {
    return {
      ...refuse(
        "enrichment",
        `Enrichment refuses overwrite of newer or existing verified data (${input.field}). ${backfill.reason}`,
        base,
      ),
      backfill,
    };
  }
  if (backfill.action !== "FILL_BLANK") {
    return {
      ...refuse("enrichment", `Enrichment skipped: ${backfill.reason}`, base),
      backfill,
    };
  }
  if (!flags.flagEnabled) {
    return {
      ...refuse("enrichment", `${CRC_WRITE_ENRICHMENT_ENV} is not true. Default fail-closed. Blank-fill only.`, base),
      backfill,
    };
  }
  return {
    ...planOk("enrichment", `Would fill blank ${input.field} from verified CRC. Not executed.`, base),
    backfill,
  };
}

export function planDocumentWrite(doc: CrcDocumentRef, classification: Phase2Class): Phase2WriteDecision {
  if (doc.rawIncluded !== false) {
    return refuse("documents", "Raw CRC files are refused. sourceSystem=CREDIT_REPAIR_CLOUD metadata only.", {
      ...flagState("documents"),
      classification,
      sourceSystem: CRC_MIGRATION_SOURCE,
    });
  }
  return planPhase2Write("documents", {
    client: {
      crcClientId: doc.crcClientId,
      firstName: "Document",
      lastName: "Metadata",
      documents: [doc],
    },
    classification,
  });
}

export function phase2SideEffects() {
  return {
    applied: false as const,
    liveClientsEnabled: CRC_PHASE2_LIVE_CLIENTS_ENABLED,
    bulkGhlCreateEnabled: CRC_PHASE2_BULK_GHL_CREATE_ENABLED,
    osCreates: 0 as const,
    ghlCreates: 0 as const,
    dfCreates: 0 as const,
    messagesSent: 0 as const,
    workflowsPublished: 0 as const,
    enrollments: 0 as const,
    welcome: CRC_DO_NOT_ENROLL.welcome,
    fridayPulse: CRC_DO_NOT_ENROLL.fridayPulse,
    flags: describeCrcWriteFlags(),
  };
}
