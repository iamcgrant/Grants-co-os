import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { attachTaxDeskClient, recordTaxDeskSession, TaxDeskError } from "@/lib/tax/desk";
import {
  CLOUD_TAX_SESSION_KINDS,
  CLOUD_TAX_STATUSES,
  SBTPG_SESSION_KINDS,
  SBTPG_STATUSES,
  type TaxDesk,
} from "@/lib/tax/catalog";

function sessionSchema(desk: TaxDesk) {
  const kinds = desk === "SBTPG" ? SBTPG_SESSION_KINDS : CLOUD_TAX_SESSION_KINDS;
  const statuses = desk === "SBTPG" ? SBTPG_STATUSES : CLOUD_TAX_STATUSES;
  return z.object({
    clientId: z.string().min(1),
    kind: z.enum(kinds),
    notes: z.string().optional(),
    result: z.string().optional(),
    status: z.enum(statuses).optional(),
    nextAction: z.string().optional(),
    taxYear: z.string().optional(),
    amountCents: z.number().int().optional(),
  });
}

const attachSchema = z.object({
  clientId: z.string().min(1),
  externalId: z.string().min(1),
  taxYear: z.string().optional(),
});

function errorStatus(e: unknown) {
  const msg = e instanceof Error ? e.message : "Error";
  const status =
    e instanceof TaxDeskError
      ? e.status
      : msg === "UNAUTHORIZED"
        ? 401
        : msg.startsWith("Forbidden") || msg === "FORBIDDEN"
          ? 403
          : 400;
  return { msg, status };
}

export async function handleTaxAttach(desk: TaxDesk, req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_OPERATIONS");
    const body = attachSchema.parse(await req.json());
    const result = await attachTaxDeskClient({
      desk,
      clientId: body.clientId,
      externalId: body.externalId,
      taxYear: body.taxYear,
      actorId: user.id,
    });
    return NextResponse.json({ identifier: result.identifier, client: result.client });
  } catch (e) {
    const { msg, status } = errorStatus(e);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function handleTaxSession(desk: TaxDesk, req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_OPERATIONS");
    const body = sessionSchema(desk).parse(await req.json());
    const result = await recordTaxDeskSession({
      desk,
      clientId: body.clientId,
      kind: body.kind,
      notes: body.notes,
      result: body.result,
      status: body.status,
      nextAction: body.nextAction,
      taxYear: body.taxYear,
      amountCents: body.amountCents,
      actorId: user.id,
    });
    return NextResponse.json({
      kind: result.kind,
      lastStepUrl: result.lastStepUrl,
      recordedAt: result.recordedAt,
    });
  } catch (e) {
    const { msg, status } = errorStatus(e);
    return NextResponse.json({ error: msg }, { status });
  }
}
