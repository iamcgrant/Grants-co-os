/**
 * Local CRC roster — CSV parser for inbound compare.
 *
 * Synthetic fixture only in repo. Real CRC exports stay in local/crc-exports/
 * (gitignored). Never invent contacts. Never print PII from a real export.
 */

import fs from "node:fs";
import path from "node:path";

export const CRC_LOCAL_ROSTER_TAG = "CRC inbound compare · synthetic roster";

export const SYNTHETIC_CRC_ROSTER_REL = "fixtures/crc-recovery/synthetic-crc-roster.csv";

export type CrcRosterRow = {
  crcClientId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  status?: string;
  verifiedActive?: boolean;
  currentlyProcessing?: boolean;
  doNotReactivate?: boolean;
  lastWorkedAt?: string;
  lastReportAt?: string;
  lastDisputeAt?: string;
  ghlContactId?: string;
  disputeFoxClientId?: string;
  smartCreditId?: string;
  grantsClientId?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  addressVerified?: boolean;
  documentTypes?: string;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function truthy(value: string | undefined): boolean | undefined {
  if (!value?.trim()) return undefined;
  return /^(1|true|yes|y)$/i.test(value.trim());
}

function emptyToUndef(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

export function parseCrcRosterCsv(text: string): CrcRosterRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: CrcRosterRow[] = [];

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h] = cols[i] ?? "";
    });
    const crcClientId = emptyToUndef(rec.crcClientId);
    const firstName = emptyToUndef(rec.firstName);
    const lastName = emptyToUndef(rec.lastName);
    if (!crcClientId || !firstName || !lastName) continue;
    rows.push({
      crcClientId,
      firstName,
      lastName,
      email: emptyToUndef(rec.email),
      phone: emptyToUndef(rec.phone),
      line1: emptyToUndef(rec.line1),
      city: emptyToUndef(rec.city),
      state: emptyToUndef(rec.state),
      postalCode: emptyToUndef(rec.postalCode),
      status: emptyToUndef(rec.status),
      verifiedActive: truthy(rec.verifiedActive),
      currentlyProcessing: truthy(rec.currentlyProcessing),
      doNotReactivate: truthy(rec.doNotReactivate),
      lastWorkedAt: emptyToUndef(rec.lastWorkedAt),
      lastReportAt: emptyToUndef(rec.lastReportAt),
      lastDisputeAt: emptyToUndef(rec.lastDisputeAt),
      ghlContactId: emptyToUndef(rec.ghlContactId),
      disputeFoxClientId: emptyToUndef(rec.disputeFoxClientId),
      smartCreditId: emptyToUndef(rec.smartCreditId),
      grantsClientId: emptyToUndef(rec.grantsClientId),
      emailVerified: truthy(rec.emailVerified),
      phoneVerified: truthy(rec.phoneVerified),
      addressVerified: truthy(rec.addressVerified),
      documentTypes: emptyToUndef(rec.documentTypes),
    });
  }
  return rows;
}

export function loadCrcRosterCsv(filePath: string): CrcRosterRow[] {
  return parseCrcRosterCsv(fs.readFileSync(filePath, "utf8"));
}

export function defaultSyntheticCrcRosterPath(cwd = process.cwd()): string {
  return path.join(cwd, SYNTHETIC_CRC_ROSTER_REL);
}
