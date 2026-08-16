/**
 * Phase 2 class-gated CRC write flags.
 *
 * Each write class has its own flag. All default false (unset / not `true`).
 * There is never a single global “write everything” switch.
 *
 * `CRC_RECOVERY_WRITES_ENABLED` is ignored when present — it does not unlock
 * enrichment, continuity links, dormant GHL org, documents, or DF create.
 *
 * This PR does not execute live Grants / GHL / DisputeFox / CRC writes.
 */

export const CRC_RECOVERY_WRITES_ENV = "CRC_RECOVERY_WRITES_ENABLED";

export const CRC_WRITE_ENRICHMENT_ENV = "CRC_WRITE_ENRICHMENT_ENABLED";
export const CRC_WRITE_ACTIVE_CONTINUITY_ENV = "CRC_WRITE_ACTIVE_CONTINUITY_ENABLED";
export const CRC_WRITE_DORMANT_GHL_ORG_ENV = "CRC_WRITE_DORMANT_GHL_ORG_ENABLED";
export const CRC_WRITE_DOCUMENTS_ENV = "CRC_WRITE_DOCUMENTS_ENABLED";
/** Strictest flag. DF create only for CONFIRMED_CONTINUITY_ACTIVE. */
export const CRC_WRITE_DF_CREATE_ENV = "CRC_WRITE_DF_CREATE_ENABLED";

export const CRC_WRITE_FLAG_ENVS = [
  CRC_WRITE_ENRICHMENT_ENV,
  CRC_WRITE_ACTIVE_CONTINUITY_ENV,
  CRC_WRITE_DORMANT_GHL_ORG_ENV,
  CRC_WRITE_DOCUMENTS_ENV,
  CRC_WRITE_DF_CREATE_ENV,
] as const;

export type CrcWriteFlagEnv = (typeof CRC_WRITE_FLAG_ENVS)[number];

export type CrcWriteFlagName =
  | "enrichment"
  | "activeContinuity"
  | "dormantGhlOrg"
  | "documents"
  | "dfCreate";

export const CRC_WRITE_FLAG_ENV_BY_NAME: Record<CrcWriteFlagName, CrcWriteFlagEnv> = {
  enrichment: CRC_WRITE_ENRICHMENT_ENV,
  activeContinuity: CRC_WRITE_ACTIVE_CONTINUITY_ENV,
  dormantGhlOrg: CRC_WRITE_DORMANT_GHL_ORG_ENV,
  documents: CRC_WRITE_DOCUMENTS_ENV,
  dfCreate: CRC_WRITE_DF_CREATE_ENV,
};

/** Hard lock — this PR never executes live client creates. */
export const CRC_PHASE2_LIVE_CLIENTS_ENABLED = false;
export const CRC_PHASE2_BULK_GHL_CREATE_ENABLED = false;
export const CRC_PHASE2_AUTO_MERGE_ENABLED = false;
export const CRC_PHASE2_GLOBAL_WRITES_HONORED = false;

function envTrue(name: string): boolean {
  return process.env[name] === "true";
}

export function isCrcWriteFlagEnabled(name: CrcWriteFlagName): boolean {
  return envTrue(CRC_WRITE_FLAG_ENV_BY_NAME[name]);
}

export type CrcWriteFlags = {
  enrichment: boolean;
  activeContinuity: boolean;
  dormantGhlOrg: boolean;
  documents: boolean;
  dfCreate: boolean;
};

export function readCrcWriteFlags(): CrcWriteFlags {
  return {
    enrichment: isCrcWriteFlagEnabled("enrichment"),
    activeContinuity: isCrcWriteFlagEnabled("activeContinuity"),
    dormantGhlOrg: isCrcWriteFlagEnabled("dormantGhlOrg"),
    documents: isCrcWriteFlagEnabled("documents"),
    dfCreate: isCrcWriteFlagEnabled("dfCreate"),
  };
}

export function defaultCrcWriteFlags(): CrcWriteFlags {
  return {
    enrichment: false,
    activeContinuity: false,
    dormantGhlOrg: false,
    documents: false,
    dfCreate: false,
  };
}

/**
 * Global Phase 1 flag is present-but-ignored for Phase 2.
 * It must never unlock a bulk / write-everything path.
 */
export function isCrcRecoveryWritesIgnored(): true {
  return true;
}

export function crcRecoveryWritesPresent(): boolean {
  return Boolean(process.env[CRC_RECOVERY_WRITES_ENV]?.trim());
}

export function describeCrcWriteFlags(): {
  flags: CrcWriteFlags;
  defaults: CrcWriteFlags;
  globalWritesEnv: typeof CRC_RECOVERY_WRITES_ENV;
  globalWritesPresent: boolean;
  globalWritesValueTrue: boolean;
  globalWritesHonored: false;
  liveClientsEnabled: false;
  bulkGhlCreateEnabled: false;
  autoMergeEnabled: false;
} {
  return {
    flags: readCrcWriteFlags(),
    defaults: defaultCrcWriteFlags(),
    globalWritesEnv: CRC_RECOVERY_WRITES_ENV,
    globalWritesPresent: crcRecoveryWritesPresent(),
    globalWritesValueTrue: envTrue(CRC_RECOVERY_WRITES_ENV),
    globalWritesHonored: false,
    liveClientsEnabled: false,
    bulkGhlCreateEnabled: false,
    autoMergeEnabled: false,
  };
}
