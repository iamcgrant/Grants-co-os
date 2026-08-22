/**
 * Official Cognito Forms REST API client.
 * Docs: https://www.cognitoforms.com/support/475/data-integration/cognito-forms-api
 * Auth: Authorization: Bearer {COGNITO_API_KEY}
 * No scrape.
 */

import { COGNITO_API_BASE, getCognitoApiKey } from "./config";

export class CognitoApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "CognitoApiError";
  }
}

export type CognitoForm = {
  id: string;
  name: string;
  internalName?: string | null;
};

export type CognitoRawEntry = Record<string, unknown>;

export type CognitoFetch = typeof fetch;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const rec = asRecord(value);
  if (!rec) return [];
  for (const key of ["value", "Value", "items", "Items", "entries", "Entries"]) {
    if (Array.isArray(rec[key])) return rec[key] as unknown[];
  }
  return [];
}

function pickString(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

export function normalizeCognitoForm(raw: unknown): CognitoForm | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = pickString(record, ["Id", "id", "FormId", "formId"]);
  const name = pickString(record, ["Name", "name", "InternalName", "internalName"]);
  if (!id || !name) return null;
  return {
    id,
    name,
    internalName: pickString(record, ["InternalName", "internalName"]),
  };
}

export function extractEntryEmail(entry: Record<string, unknown>): string | null {
  const direct = pickString(entry, [
    "Email",
    "email",
    "EmailAddress",
    "emailAddress",
    "ClientEmail",
    "clientEmail",
  ]);
  if (direct) return direct.toLowerCase();

  const nestedKeys = ["Entry", "entry", "Values", "values", "Data", "data"];
  for (const key of nestedKeys) {
    const nested = asRecord(entry[key]);
    const found = pickString(nested, ["Email", "email", "EmailAddress", "emailAddress"]);
    if (found) return found.toLowerCase();
  }
  return null;
}

export function extractEntryName(entry: Record<string, unknown>): { firstName: string | null; lastName: string | null } {
  const first = pickString(entry, ["FirstName", "firstName", "First", "first"]);
  const last = pickString(entry, ["LastName", "lastName", "Last", "last"]);
  if (first || last) return { firstName: first, lastName: last };

  const name = asRecord(entry.Name) || asRecord(entry.name);
  if (name) {
    return {
      firstName: pickString(name, ["First", "first", "FirstName", "firstName"]),
      lastName: pickString(name, ["Last", "last", "LastName", "lastName"]),
    };
  }
  return { firstName: null, lastName: null };
}

export async function cognitoGet(
  path: string,
  fetchImpl: CognitoFetch = fetch,
): Promise<unknown> {
  const apiKey = getCognitoApiKey();
  if (!apiKey) {
    throw new CognitoApiError("COGNITO_API_KEY is not set. Official API only — fail-closed.", 503);
  }

  const url = path.startsWith("http") ? path : `${COGNITO_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new CognitoApiError(`Cognito Forms API ${response.status} on ${path}`, response.status);
  }
  return response.json();
}

export async function listCognitoForms(fetchImpl: CognitoFetch = fetch): Promise<CognitoForm[]> {
  const payload = await cognitoGet("/forms", fetchImpl);
  return asArray(payload).map(normalizeCognitoForm).filter((form): form is CognitoForm => Boolean(form));
}

export async function listCognitoFormEntries(
  formId: string,
  fetchImpl: CognitoFetch = fetch,
): Promise<CognitoRawEntry[]> {
  const payload = await cognitoGet(`/forms/${encodeURIComponent(formId)}/entries`, fetchImpl);
  return asArray(payload).filter((row): row is CognitoRawEntry => Boolean(asRecord(row)));
}
