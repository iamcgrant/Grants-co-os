/**
 * DisputeFox → Grants Client inbound attach (existing master records only).
 *
 * Rules:
 * - Grants & Co OS is master identity (ONE HUMAN = ONE MASTER CLIENT RECORD)
 * - Match order: existing DF id (live only) → email (identity + known alts) → normalized phone
 * - Never create Grants clients
 * - Never create/update/delete DisputeFox records
 * - Never send messages
 * - Fail closed without DISPUTEFOX_API_KEY on the live path
 * - Do not invent DisputeFox numeric IDs
 * - Zap 374413762 stays OFF
 */

import { prisma } from "@/lib/db/prisma";
import { attachExternalIdentifier } from "@/lib/clients/service";
import { normalizeEmail, normalizePhone } from "@/lib/clients/identity";
import { addTimelineEvent } from "@/lib/clients/timeline";
import { writeAuditLog } from "@/lib/audit/log";
import { getGcEnvironment, type IdentifierMeta } from "@/lib/integrations/env";
import {
  DISPUTEFOX_LIVE_LIST_ENABLED,
  DisputeFoxApiError,
  isDisputeFoxApiReady,
  type DisputeFoxApiClient,
} from "./http";
import {
  CONFIRMED_DF_RECON_TAG,
  CONFIRMED_DF_ROSTER,
  findConfirmedDfRowByEmail,
  parseDfStageLabel,
  resolveConfirmedIdentityEmail,
} from "./roster";
import {
  DISPUTEFOX_API_KEY_ENV,
  DISPUTEFOX_ZAP_ENABLED,
  DISPUTEFOX_ZAP_ID,
} from "./secrets";

export type DfSyncAction =
  | "UPDATED"
  | "LINKED"
  | "SKIPPED_NO_MATCH"
  | "SKIPPED_AMBIGUOUS"
  | "UNCHANGED";

export type DfMatchBy = "df_id" | "email" | "phone";

export type DfSyncResult = {
  action: DfSyncAction;
  grantsClientId?: string;
  clientId?: string;
  disputeFoxClientId?: string;
  matchedBy?: DfMatchBy;
  dryRun?: boolean;
  inventedDfId?: false;
  message?: string;
};

export type DfSyncOptions = {
  dryRun?: boolean;
  actorId?: string;
};

type MatchedClient = {
  id: string;
  grantsClientId: string;
  email: string;
  emailNormalized: string;
  phone: string | null;
  phoneNormalized: string | null;
  firstName: string;
  lastName: string;
  stage: string;
  nextAction: string | null;
  nextActionOwner: string | null;
};

export async function markDisputeFoxInboundConnection(status = "CONNECTED") {
  await ensureIntegrationConnection(status);
}

async function ensureIntegrationConnection(status: string) {
  await prisma.integrationConnection.upsert({
    where: { provider: "disputefox" },
    create: {
      provider: "disputefox",
      status,
      lastSyncAt: new Date(),
      configJson: JSON.stringify({
        dataPlane: getGcEnvironment(),
        inboundOnly: true,
        existingMasterRecordsOnly: true,
        zapId: DISPUTEFOX_ZAP_ID,
        zapEnabled: DISPUTEFOX_ZAP_ENABLED,
        liveListEnabled: DISPUTEFOX_LIVE_LIST_ENABLED,
        localRoster: CONFIRMED_DF_RECON_TAG,
      }),
    },
    update: {
      status,
      lastSyncAt: new Date(),
      configJson: JSON.stringify({
        dataPlane: getGcEnvironment(),
        inboundOnly: true,
        existingMasterRecordsOnly: true,
        zapId: DISPUTEFOX_ZAP_ID,
        zapEnabled: DISPUTEFOX_ZAP_ENABLED,
        liveListEnabled: DISPUTEFOX_LIVE_LIST_ENABLED,
        localRoster: CONFIRMED_DF_RECON_TAG,
      }),
    },
  });
}

async function recordSyncEvent(input: {
  direction: string;
  entityType: string;
  externalId?: string;
  status: string;
  payload?: unknown;
  errorMessage?: string;
}) {
  const connection = await prisma.integrationConnection.findUnique({
    where: { provider: "disputefox" },
  });
  if (!connection) return;
  await prisma.integrationSyncEvent.create({
    data: {
      connectionId: connection.id,
      direction: input.direction,
      entityType: input.entityType,
      externalId: input.externalId,
      status: input.status,
      payloadJson: input.payload ? JSON.stringify(input.payload) : null,
      errorMessage: input.errorMessage,
    },
  });
}

export function failClosedWithoutDisputeFoxKey(dryRun = false) {
  return {
    ready: false as const,
    dryRun,
    failedClosed: true as const,
    results: [] as DfSyncResult[],
    fetched: 0,
    requiredSecrets: [DISPUTEFOX_API_KEY_ENV],
    zapId: DISPUTEFOX_ZAP_ID,
    zapEnabled: DISPUTEFOX_ZAP_ENABLED,
    liveListEnabled: DISPUTEFOX_LIVE_LIST_ENABLED,
    message: `Fail-closed: ${DISPUTEFOX_API_KEY_ENV} is not set. Add it to host/runtime secrets (never commit). Do not regenerate the Fox API key. Zap ${DISPUTEFOX_ZAP_ID} stays OFF.`,
  };
}

/**
 * Match order is strict: existing DF identifier → email (incl. known alts) → phone.
 * Never creates a Grants Client.
 */
export async function matchExistingGrantsClientForDf(contact: DisputeFoxApiClient): Promise<
  | { client: MatchedClient; matchedBy: DfMatchBy }
  | { client: null; matchedBy: null; skip: "NO_MATCH" | "AMBIGUOUS" | "INVALID" }
> {
  const dfId = contact.id?.trim();
  if (dfId) {
    const existingIdent = await prisma.clientIdentifier.findUnique({
      where: {
        provider_externalId: { provider: "DISPUTEFOX", externalId: dfId },
      },
      include: { client: true },
    });
    if (existingIdent) {
      return { client: existingIdent.client, matchedBy: "df_id" };
    }
  }

  const identityEmail = resolveConfirmedIdentityEmail(contact.email);
  if (identityEmail) {
    const byEmail = await prisma.client.findUnique({
      where: { emailNormalized: identityEmail },
    });
    if (byEmail) {
      return { client: byEmail, matchedBy: "email" };
    }
  }

  const phoneNormalized = normalizePhone(contact.phone);
  if (phoneNormalized) {
    const byPhone = await prisma.client.findMany({
      where: { phoneNormalized },
    });
    if (byPhone.length > 1) {
      return { client: null, matchedBy: null, skip: "AMBIGUOUS" };
    }
    if (byPhone.length === 1) {
      return { client: byPhone[0], matchedBy: "phone" };
    }
  }

  if (!dfId && !identityEmail && !phoneNormalized) {
    return { client: null, matchedBy: null, skip: "INVALID" };
  }
  return { client: null, matchedBy: null, skip: "NO_MATCH" };
}

function operationalFieldsFromContact(contact: DisputeFoxApiClient) {
  const row = findConfirmedDfRowByEmail(contact.email);
  const label = contact.stage?.trim() || row?.dfStageLabel || "";
  const parsed = label ? parseDfStageLabel(label) : null;
  const started = contact.started ?? row?.started ?? Boolean(parsed);
  return { parsed, started, label };
}

async function applyInboundAttach(input: {
  client: MatchedClient;
  contact: DisputeFoxApiClient;
  matchedBy: DfMatchBy;
  actorId?: string;
  dryRun?: boolean;
  source: IdentifierMeta["source"];
}): Promise<DfSyncResult> {
  const { client, contact, matchedBy, actorId, dryRun, source } = input;
  const dfId = contact.id?.trim() || undefined;
  const { parsed, started, label } = operationalFieldsFromContact(contact);
  const action: DfSyncAction = matchedBy === "df_id" ? "UPDATED" : "LINKED";

  if (dryRun) {
    return {
      action,
      grantsClientId: client.grantsClientId,
      clientId: client.id,
      disputeFoxClientId: dfId,
      matchedBy,
      dryRun: true,
      inventedDfId: false,
      message: `Dry-run: would ${action.toLowerCase()} ${client.grantsClientId} via ${matchedBy}`,
    };
  }

  const stage = parsed?.clientStage || client.stage;
  const nextAction = parsed?.nextAction || client.nextAction;
  const nextActionOwner = parsed?.nextActionOwner || client.nextActionOwner;

  const existingRound = parsed
    ? await prisma.disputeRound.findUnique({
        where: {
          clientId_roundNumber: { clientId: client.id, roundNumber: parsed.roundNumber },
        },
      })
    : null;

  const unchanged =
    client.stage === stage &&
    client.nextAction === nextAction &&
    client.nextActionOwner === nextActionOwner &&
    (!parsed ||
      (existingRound?.status === parsed.disputeRoundStatus &&
        existingRound?.notes?.includes(CONFIRMED_DF_RECON_TAG))) &&
    (!dfId ||
      Boolean(
        await prisma.clientIdentifier.findUnique({
          where: { provider_externalId: { provider: "DISPUTEFOX", externalId: dfId } },
        }),
      ));

  if (unchanged && matchedBy !== "df_id") {
    return {
      action: "UNCHANGED",
      grantsClientId: client.grantsClientId,
      clientId: client.id,
      disputeFoxClientId: dfId,
      matchedBy,
      inventedDfId: false,
    };
  }

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: {
      stage,
      nextAction,
      nextActionOwner,
      lastInteractionAt: new Date(),
    },
  });

  if (parsed) {
    await prisma.disputeRound.upsert({
      where: {
        clientId_roundNumber: { clientId: updated.id, roundNumber: parsed.roundNumber },
      },
      create: {
        clientId: updated.id,
        roundNumber: parsed.roundNumber,
        status: parsed.disputeRoundStatus,
        notes: `${CONFIRMED_DF_RECON_TAG} · ${label} · started=${started}`,
      },
      update: {
        status: parsed.disputeRoundStatus,
        notes: `${CONFIRMED_DF_RECON_TAG} · ${label} · started=${started}`,
      },
    });
  }

  if (dfId) {
    const meta: IdentifierMeta = {
      source: source || "disputefox_api",
      dataPlane: getGcEnvironment(),
      syncedAt: new Date().toISOString(),
      pipelineStage: label || undefined,
    };
    await attachExternalIdentifier({
      clientId: updated.id,
      provider: "DISPUTEFOX",
      externalId: dfId,
      metadata: meta,
    });
  }

  await addTimelineEvent({
    clientId: updated.id,
    actorId,
    eventType: dfId ? (matchedBy === "df_id" ? "DF_SYNC" : "DF_LINKED") : "DF_LOCAL_ATTACH",
    title: dfId
      ? matchedBy === "df_id"
        ? "DisputeFox client synced"
        : "DisputeFox client linked"
      : "DisputeFox local attach",
    description: dfId
      ? matchedBy === "df_id"
        ? `Updated from DisputeFox · ${dfId}`
        : `Linked to existing ${updated.grantsClientId} via ${matchedBy}`
      : `${CONFIRMED_DF_RECON_TAG} · ${label || "stage/started"} via ${matchedBy}`,
    idempotencyKey: dfId
      ? `df_link:${dfId}:${updated.id}`
      : `df_local_attach:${updated.id}:${parsed?.roundNumber ?? "none"}:${parsed?.phase ?? "none"}`,
  });

  if (matchedBy !== "df_id") {
    await writeAuditLog({
      actorId,
      action: dfId ? "DF_CLIENT_LINKED" : "DF_LOCAL_ATTACHED",
      entityType: "Client",
      entityId: updated.id,
      metadata: {
        grantsClientId: updated.grantsClientId,
        matchedBy,
        hasDisputeFoxId: Boolean(dfId),
        inventedDfId: false,
      },
    });
  }

  await recordSyncEvent({
    direction: "inbound",
    entityType: "client",
    externalId: dfId,
    status: action,
    payload: { grantsClientId: updated.grantsClientId, matchedBy, inventedDfId: false },
  });

  return {
    action,
    grantsClientId: updated.grantsClientId,
    clientId: updated.id,
    disputeFoxClientId: dfId,
    matchedBy,
    inventedDfId: false,
  };
}

/**
 * Attach one DisputeFox payload onto an existing Grants master client.
 * Does not create Grants clients. Does not write to DisputeFox.
 * Does not invent a DF id when the payload has none.
 */
export async function syncDisputeFoxClientToGrants(
  contact: DisputeFoxApiClient,
  actorId?: string,
  options?: DfSyncOptions,
): Promise<DfSyncResult> {
  const dryRun = Boolean(options?.dryRun);
  const actor = options?.actorId ?? actorId;
  const dfId = contact.id?.trim() || "";

  const match = await matchExistingGrantsClientForDf(contact);
  if (!match.client) {
    const action: DfSyncAction =
      match.skip === "AMBIGUOUS" ? "SKIPPED_AMBIGUOUS" : "SKIPPED_NO_MATCH";
    const message =
      match.skip === "INVALID"
        ? "Missing email, phone, and DisputeFox id — not created"
        : match.skip === "AMBIGUOUS"
          ? "Multiple Grants clients matched normalized phone — resolve manually before linking"
          : "No existing Grants master client matched email or normalized phone — not created";

    if (!dryRun && dfId) {
      await recordSyncEvent({
        direction: "inbound",
        entityType: "client",
        externalId: dfId,
        status: action,
        errorMessage: message,
      });
    }

    return {
      action,
      disputeFoxClientId: dfId || undefined,
      dryRun: dryRun || undefined,
      inventedDfId: false,
      message,
    };
  }

  return applyInboundAttach({
    client: match.client,
    contact,
    matchedBy: match.matchedBy,
    actorId: actor,
    dryRun,
    source: dfId ? "disputefox_api" : "manual",
  });
}

/**
 * Idempotent local attach from the checked-in 26-row roster (email + DF stage/started).
 * Does not need DISPUTEFOX_API_KEY. Does not invent DF numeric IDs.
 * Does not create Grants clients. Does not call DisputeFox or GHL.
 */
export async function attachConfirmedDfRoster(input?: {
  actorId?: string;
  dryRun?: boolean;
}): Promise<{
  ready: boolean;
  dryRun: boolean;
  local: true;
  roster: number;
  results: DfSyncResult[];
  attached: number;
  unchanged: number;
  skipped: number;
  inventedDfIds: 0;
  zapEnabled: false;
  message: string;
}> {
  const dryRun = Boolean(input?.dryRun);
  const results: DfSyncResult[] = [];

  for (const row of CONFIRMED_DF_ROSTER) {
    results.push(
      await syncDisputeFoxClientToGrants(
        {
          email: row.email,
          stage: row.dfStageLabel,
          started: row.started,
        },
        input?.actorId,
        { dryRun },
      ),
    );
  }

  if (!dryRun) {
    await ensureIntegrationConnection("LOCAL_ROSTER");
  }

  const attached = results.filter((r) => r.action === "LINKED" || r.action === "UPDATED").length;
  const unchanged = results.filter((r) => r.action === "UNCHANGED").length;
  const skipped = results.filter(
    (r) => r.action === "SKIPPED_NO_MATCH" || r.action === "SKIPPED_AMBIGUOUS",
  ).length;

  return {
    ready: true,
    dryRun,
    local: true,
    roster: CONFIRMED_DF_ROSTER.length,
    results,
    attached,
    unchanged,
    skipped,
    inventedDfIds: 0,
    zapEnabled: false,
    message: dryRun
      ? "Dry-run: no Grants client writes. No DisputeFox or GHL writes. Zap 374413762 stays OFF."
      : "Local roster attach onto existing master client records only. No DF/GHL writes. No invented DF ids. Zap 374413762 stays OFF.",
  };
}

/**
 * Live pull. Without DISPUTEFOX_API_KEY this fails closed (no HTTP, no client writes).
 * With a key, live list stays disabled — Zap 374413762 remains OFF.
 */
export async function pullDisputeFoxClients(input: {
  actorId?: string;
  dryRun?: boolean;
}): Promise<{
  ready: boolean;
  dryRun: boolean;
  failedClosed?: boolean;
  results: DfSyncResult[];
  fetched: number;
  message?: string;
  requiredSecrets?: string[];
  zapId: string;
  zapEnabled: false;
  liveListEnabled: false;
}> {
  const dryRun = Boolean(input.dryRun);

  if (!isDisputeFoxApiReady()) {
    if (!dryRun) {
      await ensureIntegrationConnection("AWAITING_CREDENTIALS");
    }
    return failClosedWithoutDisputeFoxKey(dryRun);
  }

  if (!DISPUTEFOX_LIVE_LIST_ENABLED) {
    return {
      ready: true,
      dryRun,
      results: [],
      fetched: 0,
      zapId: DISPUTEFOX_ZAP_ID,
      zapEnabled: false,
      liveListEnabled: false,
      message: `Live DisputeFox list is not enabled. Zap ${DISPUTEFOX_ZAP_ID} stays OFF. Use local roster attach. No DF writes.`,
    };
  }

  throw new DisputeFoxApiError("Live DisputeFox list must stay disabled", 403);
}
