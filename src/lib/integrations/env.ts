/**
 * Development vs production data-plane separation.
 * Never mix live production CRM records into a development database (or vice versa).
 */

export type GcEnvironment = "development" | "production";

export function getGcEnvironment(): GcEnvironment {
  return process.env.GC_ENV === "production" ? "production" : "development";
}

export function isDevelopmentDataPlane(): boolean {
  return getGcEnvironment() === "development";
}

export type IdentifierSource = "ghl_api" | "disputefox_api" | "seed" | "manual" | "unknown";

export type IdentifierMeta = {
  source?: IdentifierSource;
  dataPlane?: GcEnvironment;
  syncedAt?: string;
  locationId?: string;
  tags?: string[];
  pipelineStage?: string;
  assignedUserId?: string;
  raw?: Record<string, unknown>;
};

export function parseIdentifierMeta(metadataJson: string | null | undefined): IdentifierMeta {
  if (!metadataJson) return {};
  try {
    const parsed = JSON.parse(metadataJson) as IdentifierMeta;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function isLiveSyncedIdentifier(metadataJson: string | null | undefined): boolean {
  const meta = parseIdentifierMeta(metadataJson);
  return meta.source === "ghl_api" || meta.source === "disputefox_api";
}

export function isSeedIdentifier(metadataJson: string | null | undefined): boolean {
  const meta = parseIdentifierMeta(metadataJson);
  return meta.source === "seed" || (!meta.source && !meta.syncedAt);
}
