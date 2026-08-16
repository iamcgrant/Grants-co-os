/**
 * Credit Repair Cloud secret / env names. Document names only — never log values.
 * Live CRC HTTP fails closed without CRC_API_KEY. This path does not call CRC.
 */

export const CRC_API_KEY_ENV = "CRC_API_KEY";

/**
 * Phase 1 apply/create lock name. Phase 2 ignores this flag — it is never a
 * global “write everything” switch. Class-gated flags live in write-flags.ts.
 */
export const CRC_RECOVERY_WRITES_ENV = "CRC_RECOVERY_WRITES_ENABLED";

export {
  CRC_WRITE_ACTIVE_CONTINUITY_ENV,
  CRC_WRITE_DF_CREATE_ENV,
  CRC_WRITE_DOCUMENTS_ENV,
  CRC_WRITE_DORMANT_GHL_ORG_ENV,
  CRC_WRITE_ENRICHMENT_ENV,
  CRC_WRITE_FLAG_ENVS,
} from "./write-flags";

export function isCrcRecoveryWritesEnabled(): boolean {
  return process.env[CRC_RECOVERY_WRITES_ENV] === "true";
}
