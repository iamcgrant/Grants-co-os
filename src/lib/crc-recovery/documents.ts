/**
 * CRC document / report provenance.
 * Raw sensitive files stay in secure storage — never GitHub, never logs, never chat.
 */

import { CRC_MIGRATION_SOURCE } from "./locks";
import type { CrcDocumentRef } from "./types";

export type CrcDocumentProvenance = {
  sourceSystem: typeof CRC_MIGRATION_SOURCE;
  originalDate: string;
  crcClientId: string;
  documentType: string;
};

export function provenanceFor(doc: CrcDocumentRef): CrcDocumentProvenance {
  return {
    sourceSystem: CRC_MIGRATION_SOURCE,
    originalDate: doc.originalDate,
    crcClientId: doc.crcClientId,
    documentType: doc.documentType,
  };
}

export function assertNoRawDocumentPayload(doc: CrcDocumentRef): void {
  if (doc.rawIncluded !== false) {
    throw new Error("CRC document refs must set rawIncluded=false");
  }
}

export function publicDocumentRow(doc: CrcDocumentRef): {
  id: string;
  crcClientId: string;
  documentType: string;
  originalDate: string;
  sourceSystem: typeof CRC_MIGRATION_SOURCE;
} {
  assertNoRawDocumentPayload(doc);
  return {
    id: doc.id,
    crcClientId: doc.crcClientId,
    documentType: doc.documentType,
    originalDate: doc.originalDate,
    sourceSystem: CRC_MIGRATION_SOURCE,
  };
}
