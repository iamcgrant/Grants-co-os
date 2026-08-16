/**
 * Credit Repair Cloud secret / env names. Document names only — never log values.
 * Live CRC HTTP fails closed without CRC_API_KEY. This path does not call CRC.
 */

export const CRC_API_KEY_ENV = "CRC_API_KEY";

/** Apply/create lock. Must stay false for this identify + dry-run PR. */
export const CRC_RECOVERY_WRITES_ENV = "CRC_RECOVERY_WRITES_ENABLED";

export function isCrcRecoveryWritesEnabled(): boolean {
  return process.env[CRC_RECOVERY_WRITES_ENV] === "true";
}
