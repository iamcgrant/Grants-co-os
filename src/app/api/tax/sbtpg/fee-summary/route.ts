import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { SbtpgPayoutError } from "@/lib/tax/payouts";
import {
  getLatestOfficialFeeSummary,
  officialFeeSummaryFromCaptureKey,
  persistOfficialSbtpgFeeSummary,
} from "@/lib/tax/official-fee-summary";

const ingestSchema = z.object({
  ingestCaptured: z.string().optional(),
  taxYear: z.string().optional(),
  capturedOn: z.string().optional(),
  capturedAt: z.string().optional(),
  sourceLabel: z.string().optional(),
  sourceUrl: z.string().nullable().optional(),
  paidCents: z.number().int().optional(),
  paidTaxpayerCount: z.number().int().optional(),
  unfundedCents: z.number().int().optional(),
  unfundedTaxpayerCount: z.number().int().optional(),
  fcaCents: z.number().int().optional(),
  fcaTaxpayerCount: z.number().int().optional(),
  autoCollectCents: z.number().int().optional(),
  notes: z.string().nullable().optional(),
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
    const official = await getLatestOfficialFeeSummary();
    return NextResponse.json({ official });
  } catch (e) {
    const { msg, status } = errorStatus(e);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_OPERATIONS");
    const body = ingestSchema.parse(await req.json());
    const official = body.ingestCaptured
      ? officialFeeSummaryFromCaptureKey(body.ingestCaptured)
      : {
          taxYear: body.taxYear || "",
          capturedOn: body.capturedOn || "",
          capturedAt: body.capturedAt || new Date().toISOString(),
          sourceLabel: body.sourceLabel || "SBTPG Fee Summary",
          sourceUrl: body.sourceUrl ?? null,
          paidCents: body.paidCents ?? 0,
          paidTaxpayerCount: body.paidTaxpayerCount ?? 0,
          unfundedCents: body.unfundedCents ?? 0,
          unfundedTaxpayerCount: body.unfundedTaxpayerCount ?? 0,
          fcaCents: body.fcaCents ?? 0,
          fcaTaxpayerCount: body.fcaTaxpayerCount ?? 0,
          autoCollectCents: body.autoCollectCents ?? 0,
          notes: body.notes ?? null,
        };
    if (!official.taxYear || !official.capturedOn) {
      throw new SbtpgPayoutError("Official Fee Summary needs taxYear and capturedOn");
    }
    const result = await persistOfficialSbtpgFeeSummary(official, { recordedById: user.id });
    return NextResponse.json({
      official: await getLatestOfficialFeeSummary(),
      snapshotId: result.snapshot.id,
      paidPayoutId: result.paidPayout.id,
    });
  } catch (e) {
    const { msg, status } = errorStatus(e);
    return NextResponse.json({ error: msg }, { status });
  }
}
