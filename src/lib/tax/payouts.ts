/**
 * OS-recorded SBTPG payouts. Official portal is last-step only. No scrape.
 * Collected = PAID or FUNDED amounts dated by paidAt (else createdAt).
 */

import { startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { addTimelineEvent } from "@/lib/clients/timeline";
import { isSbtpgStatus, type SbtpgStatus } from "@/lib/tax/catalog";

export const SBTPG_COLLECTED_STATUSES = ["PAID", "FUNDED"] as const;
export const SBTPG_PAYOUT_SOURCES = ["staff_recorded", "official_import"] as const;
export const SBTPG_WINDOW_KINDS = ["dated", "season_to_date"] as const;
export const SBTPG_PAYOUT_BUCKETS = [
  "PAYOUT",
  "FEE_SUMMARY_PAID",
  "FEE_SUMMARY_UNFUNDED",
  "FCA",
  "AUTO_COLLECT",
] as const;

export type SbtpgPayoutSource = (typeof SBTPG_PAYOUT_SOURCES)[number];
export type SbtpgWindowKind = (typeof SBTPG_WINDOW_KINDS)[number];
export type SbtpgPayoutBucket = (typeof SBTPG_PAYOUT_BUCKETS)[number];

export class SbtpgPayoutError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "SbtpgPayoutError";
  }
}

export type RecordSbtpgPayoutInput = {
  amountCents: number;
  status?: string;
  clientId?: string | null;
  externalId?: string | null;
  taxYear?: string | null;
  paidAt?: Date | string | null;
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
  source?: SbtpgPayoutSource;
  windowKind?: SbtpgWindowKind;
  bucket?: SbtpgPayoutBucket;
  taxpayerCount?: number | null;
  notes?: string | null;
  recordedById?: string;
};

export type SbtpgCollectedTotals = {
  collectedTodayCents: number;
  collectedWeekCents: number;
  collectedMonthCents: number;
  collectedAllCents: number;
  payoutCount: number;
  seasonToDatePayoutCount: number;
  asOf: string;
};

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function collectedAt(row: { paidAt: Date | null; createdAt: Date }): Date {
  return row.paidAt ?? row.createdAt;
}

export function isSbtpgCollectedStatus(status: string): boolean {
  return (SBTPG_COLLECTED_STATUSES as readonly string[]).includes(status);
}

export function dollarsToCents(raw: string | number): number {
  const parsed = typeof raw === "number" ? raw : Number(String(raw).trim().replace(/[$,]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new SbtpgPayoutError("Payout amount must be greater than zero");
  }
  return Math.round(parsed * 100);
}

async function findOptionalClient(clientId?: string | null) {
  if (!clientId?.trim()) return null;
  const client = await prisma.client.findFirst({
    where: { OR: [{ id: clientId }, { grantsClientId: clientId }] },
    select: { id: true, grantsClientId: true },
  });
  if (!client) throw new SbtpgPayoutError("Client not found", 404);
  return client;
}

export async function recordSbtpgPayout(input: RecordSbtpgPayoutInput) {
  const amountCents = Math.round(input.amountCents);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new SbtpgPayoutError("Payout amount must be greater than zero");
  }
  const status = (input.status?.trim() || "PAID") as SbtpgStatus;
  if (!isSbtpgStatus(status)) {
    throw new SbtpgPayoutError("Unknown SBTPG payout status");
  }
  const source: SbtpgPayoutSource = input.source === "official_import" ? "official_import" : "staff_recorded";
  const windowKind: SbtpgWindowKind = input.windowKind === "season_to_date" ? "season_to_date" : "dated";
  const bucket: SbtpgPayoutBucket =
    input.bucket && (SBTPG_PAYOUT_BUCKETS as readonly string[]).includes(input.bucket)
      ? input.bucket
      : "PAYOUT";
  const taxpayerCount =
    typeof input.taxpayerCount === "number" && Number.isFinite(input.taxpayerCount)
      ? Math.round(input.taxpayerCount)
      : null;
  const client = await findOptionalClient(input.clientId);
  const externalId = input.externalId?.trim() || null;
  const paidAt = parseDate(input.paidAt);
  const periodStart = parseDate(input.periodStart);
  const periodEnd = parseDate(input.periodEnd);
  const notes = input.notes?.trim() || null;
  const taxYear = input.taxYear?.trim() || null;

  let payout: {
    id: string;
    amountCents: number;
    status: string;
    clientId: string | null;
    externalId: string | null;
  } | undefined;
  if (externalId) {
    const existing = await prisma.sbtpgPayout.findFirst({ where: { externalId } });
    if (existing) {
      payout = await prisma.sbtpgPayout.update({
        where: { id: existing.id },
        data: {
          clientId: client?.id ?? existing.clientId,
          amountCents,
          status,
          taxYear,
          paidAt,
          periodStart,
          periodEnd,
          source,
          windowKind,
          bucket,
          taxpayerCount,
          notes,
          recordedById: input.recordedById ?? existing.recordedById,
        },
      });
    }
  }

  if (!payout) {
    payout = await prisma.sbtpgPayout.create({
      data: {
        clientId: client?.id ?? null,
        externalId,
        amountCents,
        status,
        taxYear,
        paidAt,
        periodStart,
        periodEnd,
        source,
        windowKind,
        bucket,
        taxpayerCount,
        notes,
        recordedById: input.recordedById,
      },
    });
  }

  if (client) {
    await addTimelineEvent({
      clientId: client.id,
      actorId: input.recordedById,
      eventType: "SBTPG_PAYOUT_RECORDED",
      title: `SBTPG payout ${status.toLowerCase()}`,
      description: notes || `Official SBTPG payout recorded · ${amountCents} cents`,
      idempotencyKey: `sbtpg_payout:${payout.id}`,
      metadata: { payoutId: payout.id, amountCents, status, externalId },
    });
  }

  await writeAuditLog({
    actorId: input.recordedById,
    action: "SBTPG_PAYOUT_RECORDED",
    entityType: "SbtpgPayout",
    entityId: payout.id,
    metadata: {
      amountCents,
      status,
      source,
      windowKind,
      bucket,
      taxpayerCount,
      grantsClientId: client?.grantsClientId ?? null,
      externalId,
    },
  });

  return payout;
}

export type OfficialPayoutImportRow = {
  amount: string | number;
  amountCents?: number;
  status?: string;
  clientId?: string | null;
  externalId?: string | null;
  taxYear?: string | null;
  paidAt?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  notes?: string | null;
};

export function parseOfficialPayoutImport(raw: string): OfficialPayoutImportRow[] {
  const text = raw.trim();
  if (!text) throw new SbtpgPayoutError("Paste official payout totals to import");

  if (text.startsWith("[") || text.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new SbtpgPayoutError("Official import JSON is invalid");
    }
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.map((row) => {
      if (!row || typeof row !== "object") throw new SbtpgPayoutError("Official import row is invalid");
      const record = row as Record<string, unknown>;
      const amount =
        typeof record.amountCents === "number"
          ? record.amountCents / 100
          : (record.amount as string | number | undefined);
      if (amount == null) throw new SbtpgPayoutError("Each official import row needs amount or amountCents");
      return {
        amount,
        amountCents: typeof record.amountCents === "number" ? record.amountCents : undefined,
        status: typeof record.status === "string" ? record.status : undefined,
        clientId: typeof record.clientId === "string" ? record.clientId : null,
        externalId:
          typeof record.externalId === "string"
            ? record.externalId
            : typeof record.id === "string"
              ? record.id
              : null,
        taxYear: typeof record.taxYear === "string" ? record.taxYear : null,
        paidAt: typeof record.paidAt === "string" ? record.paidAt : null,
        periodStart: typeof record.periodStart === "string" ? record.periodStart : null,
        periodEnd: typeof record.periodEnd === "string" ? record.periodEnd : null,
        notes: typeof record.notes === "string" ? record.notes : null,
      };
    });
  }

  return text.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return [];
    const cols = trimmed.split(",").map((col) => col.trim());
    const [amount, status, paidAt, externalId, taxYear, notes] = cols;
    if (!amount) return [];
    return [
      {
        amount,
        status,
        paidAt: paidAt || null,
        externalId: externalId || null,
        taxYear: taxYear || null,
        notes: notes || null,
      },
    ];
  });
}

export async function importOfficialSbtpgPayouts(input: {
  rows: OfficialPayoutImportRow[];
  recordedById?: string;
}) {
  if (!input.rows.length) throw new SbtpgPayoutError("No official payout rows to import");
  const payouts = [];
  for (const row of input.rows) {
    const amountCents = row.amountCents ?? dollarsToCents(row.amount);
    payouts.push(
      await recordSbtpgPayout({
        amountCents,
        status: row.status,
        clientId: row.clientId,
        externalId: row.externalId,
        taxYear: row.taxYear,
        paidAt: row.paidAt,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        source: "official_import",
        notes: row.notes,
        recordedById: input.recordedById,
      }),
    );
  }
  return { imported: payouts.length, payouts };
}

export async function listSbtpgPayouts(take = 80) {
  return prisma.sbtpgPayout.findMany({
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take,
    include: {
      client: { select: { id: true, grantsClientId: true, firstName: true, lastName: true } },
    },
  });
}

export async function getSbtpgCollectedTotals(
  now = new Date(),
  windows?: { today: Date; week: Date; month: Date },
): Promise<SbtpgCollectedTotals> {
  const bounds = windows ?? {
    today: startOfDay(now),
    week: startOfWeek(now, { weekStartsOn: 1 }),
    month: startOfMonth(now),
  };
  const payouts = await prisma.sbtpgPayout.findMany({
    where: { status: { in: [...SBTPG_COLLECTED_STATUSES] } },
    select: { amountCents: true, paidAt: true, createdAt: true, windowKind: true },
  });

  let collectedTodayCents = 0;
  let collectedWeekCents = 0;
  let collectedMonthCents = 0;
  let collectedAllCents = 0;
  let datedPayoutCount = 0;

  for (const row of payouts) {
    collectedAllCents += row.amountCents;
    if (row.windowKind === "season_to_date") continue;
    datedPayoutCount += 1;
    const at = collectedAt(row);
    if (at >= bounds.today) collectedTodayCents += row.amountCents;
    if (at >= bounds.week) collectedWeekCents += row.amountCents;
    if (at >= bounds.month) collectedMonthCents += row.amountCents;
  }

  return {
    collectedTodayCents,
    collectedWeekCents,
    collectedMonthCents,
    collectedAllCents,
    payoutCount: datedPayoutCount,
    seasonToDatePayoutCount: payouts.filter((row) => row.windowKind === "season_to_date").length,
    asOf: now.toISOString(),
  };
}

export async function listSbtpgCollectedByDay(from: Date) {
  const payouts = await prisma.sbtpgPayout.findMany({
    where: {
      status: { in: [...SBTPG_COLLECTED_STATUSES] },
      windowKind: { not: "season_to_date" },
    },
    select: { amountCents: true, paidAt: true, createdAt: true },
  });
  return payouts
    .map((row) => ({ amountCents: row.amountCents, at: collectedAt(row) }))
    .filter((row) => row.at >= from);
}
