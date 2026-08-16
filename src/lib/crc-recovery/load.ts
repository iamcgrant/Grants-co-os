import fs from "node:fs";
import path from "node:path";
import type { CrcExportClient, CrcExportFile, IdentityCatalog } from "./types";
import { SYNTHETIC_CRC_EXPORT, syntheticCatalog } from "./synthetic";

export const DEFAULT_CRC_EXPORT_REL = "fixtures/crc-recovery/synthetic-crc-export.json";
export const DEFAULT_OS_CATALOG_REL = "fixtures/crc-recovery/synthetic-os-catalog.json";
export const DEFAULT_GHL_CATALOG_REL = "fixtures/crc-recovery/synthetic-ghl-catalog.json";
export const DEFAULT_DF_CATALOG_REL = "fixtures/crc-recovery/synthetic-df-catalog.json";

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseCrcExport(value: unknown): CrcExportFile {
  if (!isRecord(value)) throw new Error("CRC export must be an object");
  if (value.sourceSystem !== "CREDIT_REPAIR_CLOUD") {
    throw new Error("CRC export sourceSystem must be CREDIT_REPAIR_CLOUD");
  }
  if (!Array.isArray(value.clients)) throw new Error("CRC export must include clients[]");
  const clients = value.clients as CrcExportClient[];
  for (const client of clients) {
    if (!client?.crcClientId?.trim()) throw new Error("Each CRC client needs crcClientId");
    if (Array.isArray(client.documents)) {
      for (const doc of client.documents) {
        if (doc.rawIncluded !== false) {
          throw new Error("CRC export must not include raw document bytes");
        }
      }
    }
  }
  return {
    sourceSystem: "CREDIT_REPAIR_CLOUD",
    synthetic: value.synthetic === true,
    exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : new Date().toISOString(),
    clients,
  };
}

export function loadCrcExport(filePath?: string): CrcExportFile {
  if (!filePath) return SYNTHETIC_CRC_EXPORT;
  return parseCrcExport(readJson(path.resolve(filePath)));
}

function unwrapArray<T>(value: unknown, key: string): T[] {
  if (Array.isArray(value)) return value as T[];
  if (isRecord(value) && Array.isArray(value[key])) return value[key] as T[];
  throw new Error(`Catalog JSON must be an array or an object with ${key}[]`);
}

export function loadCatalog(input?: {
  osPath?: string;
  ghlPath?: string;
  dfPath?: string;
}): IdentityCatalog {
  const fallback = syntheticCatalog();
  return {
    osMasters: input?.osPath
      ? unwrapArray(readJson(path.resolve(input.osPath)), "masters")
      : fallback.osMasters,
    ghlContacts: input?.ghlPath
      ? unwrapArray(readJson(path.resolve(input.ghlPath)), "contacts")
      : fallback.ghlContacts,
    dfClients: input?.dfPath
      ? unwrapArray(readJson(path.resolve(input.dfPath)), "clients")
      : fallback.dfClients,
  };
}

export function defaultFixturePaths(cwd = process.cwd()) {
  return {
    crcExport: path.join(cwd, DEFAULT_CRC_EXPORT_REL),
    osCatalog: path.join(cwd, DEFAULT_OS_CATALOG_REL),
    ghlCatalog: path.join(cwd, DEFAULT_GHL_CATALOG_REL),
    dfCatalog: path.join(cwd, DEFAULT_DF_CATALOG_REL),
  };
}
