/**
 * Explicit import of Charles-confirmed active master clients.
 *
 * Creates Grants Client records only (existing Client fields).
 * Never creates GHL contacts or invents GHL ids. Never sends messages.
 * Idempotent on normalized identity email.
 */

import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/clients/service";
import { normalizeEmail } from "@/lib/clients/identity";
import {
  CONFIRMED_MASTERS,
  FORBIDDEN_IMPORT_EMAILS,
  buildConfirmedMasterNotes,
} from "./confirmed-masters";

export type ImportConfirmedMastersResult = {
  roster: number;
  created: number;
  skippedExisting: number;
  skippedDuplicate: number;
  skippedForbidden: number;
  errors: number;
  createdGhlIdentifiers: number;
};

export async function importConfirmedMasters(input?: {
  actorId?: string;
}): Promise<ImportConfirmedMastersResult> {
  const result: ImportConfirmedMastersResult = {
    roster: CONFIRMED_MASTERS.length,
    created: 0,
    skippedExisting: 0,
    skippedDuplicate: 0,
    skippedForbidden: 0,
    errors: 0,
    createdGhlIdentifiers: 0,
  };

  const forbidden = new Set(FORBIDDEN_IMPORT_EMAILS.map((e) => normalizeEmail(e)));

  for (const row of CONFIRMED_MASTERS) {
    const emailNormalized = normalizeEmail(row.email);
    if (forbidden.has(emailNormalized)) {
      result.skippedForbidden += 1;
      continue;
    }

    const existing = await prisma.client.findUnique({
      where: { emailNormalized },
    });
    if (existing) {
      result.skippedExisting += 1;
      continue;
    }

    try {
      const created = await createClient({
        email: row.email,
        phone: row.phone,
        firstName: row.firstName,
        lastName: row.lastName,
        notes: buildConfirmedMasterNotes(row),
        actorId: input?.actorId,
      });

      if (created.status === "POSSIBLE_DUPLICATE") {
        result.skippedDuplicate += 1;
        continue;
      }

      result.created += 1;
    } catch {
      result.errors += 1;
    }
  }

  return result;
}
