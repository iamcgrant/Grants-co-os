import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { SBTPG_STATUSES } from "@/lib/tax/catalog";
import {
  dollarsToCents,
  importOfficialSbtpgPayouts,
  listSbtpgPayouts,
  parseOfficialPayoutImport,
  recordSbtpgPayout,
  SbtpgPayoutError,
} from "@/lib/tax/payouts";

const recordSchema = z.object({
  amount: z.union([z.string(), z.number()]).optional(),
  amountCents: z.number().int().optional(),
  status: z.enum(SBTPG_STATUSES).optional(),
  clientId: z.string().optional(),
  externalId: z.string().optional(),
  taxYear: z.string().optional(),
  paidAt: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  notes: z.string().optional(),
  importText: z.string().optional(),
  payouts: z
    .array(
      z.object({
        amount: z.union([z.string(), z.number()]).optional(),
        amountCents: z.number().int().optional(),
        status: z.string().optional(),
        clientId: z.string().optional(),
        externalId: z.string().optional(),
        taxYear: z.string().optional(),
        paidAt: z.string().optional(),
        periodStart: z.string().optional(),
        periodEnd: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .optional(),
});

function errorStatus(e: unknown) {
  const msg = e instanceof Error ? e.message : "Error";
  const status =
    e instanceof SbtpgPayoutError
      ? e.status
      : msg === "UNAUTHORIZED"
        ? 401
        : msg.startsWith("Forbidden") || msg === "FORBIDDEN"
          ? 403
          : 400;
  return { msg, status };
}

export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user.role, "VIEW_REVENUE");
    const payouts = await listSbtpgPayouts();
    return NextResponse.json({ payouts });
  } catch (e) {
    const { msg, status } = errorStatus(e);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_OPERATIONS");
    const body = recordSchema.parse(await req.json());

    if (body.importText || body.payouts) {
      const rows = body.payouts?.length
        ? body.payouts.map((row) => ({
            amount: row.amount ?? (row.amountCents != null ? row.amountCents / 100 : ""),
            amountCents: row.amountCents,
            status: row.status,
            clientId: row.clientId,
            externalId: row.externalId,
            taxYear: row.taxYear,
            paidAt: row.paidAt,
            periodStart: row.periodStart,
            periodEnd: row.periodEnd,
            notes: row.notes,
          }))
        : parseOfficialPayoutImport(body.importText || "");
      const result = await importOfficialSbtpgPayouts({
        rows,
        recordedById: user.id,
      });
      return NextResponse.json(result);
    }

    const amountCents = body.amountCents ?? dollarsToCents(body.amount ?? "");
    const payout = await recordSbtpgPayout({
      amountCents,
      status: body.status,
      clientId: body.clientId,
      externalId: body.externalId,
      taxYear: body.taxYear,
      paidAt: body.paidAt,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      notes: body.notes,
      recordedById: user.id,
    });
    return NextResponse.json({ payout });
  } catch (e) {
    const { msg, status } = errorStatus(e);
    return NextResponse.json({ error: msg }, { status });
  }
}
