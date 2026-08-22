/**
 * In-OS Cognito Forms desk — official API list of submitted tax/client forms.
 * No scrape. Fail-closed without COGNITO_API_KEY.
 */

import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { addTimelineEvent } from "@/lib/clients/timeline";
import { attachExternalIdentifier } from "@/lib/clients/service";
import { CLIENT_IDENTIFIER_PROVIDER } from "@/lib/clients/identifiers";
import { normalizeEmail } from "@/lib/clients/identity";
import {
  CognitoApiError,
  extractEntryEmail,
  extractEntryName,
  listCognitoFormEntries,
  listCognitoForms,
  type CognitoFetch,
  type CognitoForm,
  type CognitoRawEntry,
} from "./client";
import { isCognitoConfigured } from "./config";

export const COGNITO_PROVIDER = CLIENT_IDENTIFIER_PROVIDER.COGNITO;
export const COGNITO_INTEGRATION = "cognito";

export { CognitoApiError };

export type CognitoSubmission = {
  formId: string;
  formName: string;
  entryId: string;
  submittedAt: string | null;
  status: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  taxRelated: boolean;
  clientId: string | null;
  grantsClientId: string | null;
  clientName: string | null;
};

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function isTaxRelatedForm(name: string): boolean {
  return /tax|return|1040|w-?2|intake|client|organizer|sbtpg|refund/i.test(name);
}

export function normalizeCognitoEntry(form: CognitoForm, entry: CognitoRawEntry): CognitoSubmission {
  const email = extractEntryEmail(entry);
  const names = extractEntryName(entry);
  const entryId =
    pickString(entry, ["Id", "id", "EntryNumber", "entryNumber", "Number", "number"]) || "unknown";
  const submittedAt = pickString(entry, [
    "DateCreated",
    "dateCreated",
    "DateSubmitted",
    "dateSubmitted",
    "Submitted",
    "submitted",
  ]);
  const status = pickString(entry, ["Status", "status", "EntryStatus", "entryStatus"]) || "Submitted";

  return {
    formId: form.id,
    formName: form.name,
    entryId,
    submittedAt,
    status,
    email,
    firstName: names.firstName,
    lastName: names.lastName,
    taxRelated: isTaxRelatedForm(form.name),
    clientId: null,
    grantsClientId: null,
    clientName: null,
  };
}

async function matchSubmissionToClient(row: CognitoSubmission) {
  if (!row.email) return row;
  const emailNormalized = normalizeEmail(row.email);
  const client = await prisma.client.findFirst({
    where: { emailNormalized },
    select: { id: true, grantsClientId: true, firstName: true, lastName: true },
  });
  if (!client) return row;
  return {
    ...row,
    clientId: client.id,
    grantsClientId: client.grantsClientId,
    clientName: `${client.firstName} ${client.lastName}`,
  };
}

export async function pullCognitoSubmissions(input: {
  actorId?: string;
  fetchImpl?: CognitoFetch;
}): Promise<{ submissions: CognitoSubmission[]; formCount: number; pulledAt: string }> {
  if (!isCognitoConfigured()) {
    throw new CognitoApiError("COGNITO_API_KEY is not set. Official API only — fail-closed.", 503);
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const forms = await listCognitoForms(fetchImpl);
  const submissions: CognitoSubmission[] = [];

  for (const form of forms) {
    const entries = await listCognitoFormEntries(form.id, fetchImpl);
    for (const entry of entries) {
      submissions.push(normalizeCognitoEntry(form, entry));
    }
  }

  const matched: CognitoSubmission[] = [];
  for (const row of submissions) {
    const next = await matchSubmissionToClient(row);
    if (next.clientId && next.entryId !== "unknown") {
      await attachExternalIdentifier({
        clientId: next.clientId,
        provider: COGNITO_PROVIDER,
        externalId: `${next.formId}:${next.entryId}`,
        metadata: {
          source: "cognito_api",
          formId: next.formId,
          formName: next.formName,
          entryId: next.entryId,
          submittedAt: next.submittedAt,
        },
      });
      await addTimelineEvent({
        clientId: next.clientId,
        actorId: input.actorId,
        eventType: "COGNITO_SUBMISSION",
        title: `Cognito form · ${next.formName}`,
        description: `Entry ${next.entryId}`,
        idempotencyKey: `cognito:${next.formId}:${next.entryId}:${next.clientId}`,
        metadata: { formId: next.formId, entryId: next.entryId },
      });
    }
    matched.push(next);
  }

  const now = new Date();
  const integration = await prisma.integrationConnection.upsert({
    where: { provider: COGNITO_INTEGRATION },
    create: { provider: COGNITO_INTEGRATION, status: "CONNECTED", lastSyncAt: now },
    update: { status: "CONNECTED", lastSyncAt: now },
  });

  await prisma.integrationSyncEvent.create({
    data: {
      connectionId: integration.id,
      direction: "inbound",
      entityType: "COGNITO_ENTRIES",
      status: "RECORDED",
      payloadJson: JSON.stringify({
        formCount: forms.length,
        entryCount: matched.length,
        matchedCount: matched.filter((row) => row.clientId).length,
      }),
    },
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "COGNITO_PULL",
    entityType: "IntegrationConnection",
    entityId: integration.id,
    metadata: { formCount: forms.length, entryCount: matched.length },
  });

  matched.sort((a, b) => {
    if (a.taxRelated !== b.taxRelated) return a.taxRelated ? -1 : 1;
    return (b.submittedAt || "").localeCompare(a.submittedAt || "");
  });

  return { submissions: matched, formCount: forms.length, pulledAt: now.toISOString() };
}

export async function latestCognitoPullAt(): Promise<Date | null> {
  const sync = await prisma.integrationSyncEvent.findFirst({
    where: { status: "RECORDED", entityType: "COGNITO_ENTRIES" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return sync?.createdAt ?? null;
}

export async function listCachedCognitoBoard() {
  const identifiers = await prisma.clientIdentifier.findMany({
    where: { provider: COGNITO_PROVIDER },
    orderBy: { updatedAt: "desc" },
    take: 80,
    include: {
      client: { select: { id: true, grantsClientId: true, firstName: true, lastName: true, email: true } },
    },
  });

  return identifiers.map((row) => {
    let formName = "Cognito form";
    let entryId = row.externalId;
    let submittedAt: string | null = null;
    try {
      const meta = row.metadataJson ? (JSON.parse(row.metadataJson) as Record<string, unknown>) : {};
      if (typeof meta.formName === "string") formName = meta.formName;
      if (typeof meta.entryId === "string") entryId = meta.entryId;
      if (typeof meta.submittedAt === "string") submittedAt = meta.submittedAt;
    } catch {
      /* ignore */
    }
    return {
      formName,
      entryId,
      submittedAt,
      clientId: row.client.id,
      grantsClientId: row.client.grantsClientId,
      clientName: `${row.client.firstName} ${row.client.lastName}`,
      email: row.client.email,
    };
  });
}
