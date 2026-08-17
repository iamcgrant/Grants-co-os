import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ensureMasterOnboarding } from "@/lib/clients/onboarding-runtime";
import { resolveDisputeFoxIntakeUrl } from "@/lib/payments/post-payment";
import { CLIENT_IDENTIFIER_PROVIDER } from "@/lib/clients/identifiers";
import { queueAutomation } from "@/lib/automations/engine";
import { addTimelineEvent } from "@/lib/clients/timeline";
import { normalizeEmail, normalizePhone } from "@/lib/clients/identity";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const row = await prisma.onboardingToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { client: true },
  });

  if (!row || row.revokedAt) {
    return NextResponse.json({ valid: false, error: "Invalid or expired setup link" }, { status: 404 });
  }
  if (row.expiresAt < new Date()) {
    return NextResponse.json({ valid: false, error: "This setup link has expired" }, { status: 410 });
  }

  const intakeDone = await prisma.onboardingItem.findFirst({
    where: { clientId: row.clientId, key: "intake", status: "COMPLETE" },
  });

  return NextResponse.json({
    valid: true,
    alreadyComplete: Boolean(row.usedAt || intakeDone),
    grantsClientId: row.client.grantsClientId,
    serviceName: row.serviceName,
    prefill: row.prefillJson ? JSON.parse(row.prefillJson) : null,
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const body = (await req.json()) as Record<string, string>;

  const row = await prisma.onboardingToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { client: { include: { identifiers: true } } },
  });

  if (!row || row.revokedAt) {
    return NextResponse.json({ error: "Invalid setup link" }, { status: 404 });
  }
  if (row.expiresAt < new Date()) {
    return NextResponse.json({ error: "Setup link expired" }, { status: 410 });
  }

  // Never create a second master — update the existing client only.
  const email = normalizeEmail(body.email || row.email);
  const phone = normalizePhone(body.phone || row.phone);

  await prisma.client.update({
    where: { id: row.clientId },
    data: {
      firstName: (body.firstName || row.client.firstName).trim(),
      lastName: (body.lastName || row.client.lastName).trim(),
      email,
      emailNormalized: email,
      phone: body.phone || row.client.phone,
      phoneNormalized: phone,
      notes: [row.client.notes, body.goals ? `Goals: ${body.goals}` : null]
        .filter(Boolean)
        .join("\n"),
      stage: "INTAKE_COMPLETE",
      nextAction: "Prepare file",
      nextActionOwner: "JONA",
    },
  });

  if (body.addressLine1 && body.city && body.state && body.postalCode) {
    const existingAddr = await prisma.address.findFirst({
      where: { clientId: row.clientId, type: "PRIMARY" },
    });
    if (existingAddr) {
      await prisma.address.update({
        where: { id: existingAddr.id },
        data: {
          line1: body.addressLine1,
          city: body.city,
          state: body.state,
          postalCode: body.postalCode,
        },
      });
    } else {
      await prisma.address.create({
        data: {
          clientId: row.clientId,
          type: "PRIMARY",
          line1: body.addressLine1,
          city: body.city,
          state: body.state,
          postalCode: body.postalCode,
        },
      });
    }
  }

  await ensureMasterOnboarding(row.clientId);
  await prisma.onboardingItem.updateMany({
    where: { clientId: row.clientId, key: "intake" },
    data: { status: "COMPLETE", completedAt: new Date() },
  });

  await prisma.onboardingToken.update({
    where: { id: row.id },
    data: {
      usedAt: row.usedAt || new Date(),
      answersJson: JSON.stringify({
        ...body,
        ssnLast4: body.ssnLast4 ? "****" : undefined, // never store raw SSN beyond last4 intent in answers dump — strip
        submittedAt: new Date().toISOString(),
      }),
    },
  });

  // Store last4 only in encrypted-ish notes field via metadata on identifier — prefer audit without SSN
  await addTimelineEvent({
    clientId: row.clientId,
    eventType: "INTAKE_COMPLETED",
    title: "Client setup completed",
    description: "Native Grants & Co intake submitted",
    idempotencyKey: `intake:${row.id}`,
  });

  await queueAutomation({
    kind: "INTAKE_COMPLETED",
    clientId: row.clientId,
    entityType: "OnboardingToken",
    entityId: row.id,
    idempotencyKey: `intake_completed:${row.id}`,
  });

  const dfId = row.client.identifiers.find(
    (i) => i.provider === CLIENT_IDENTIFIER_PROVIDER.DISPUTEFOX,
  )?.externalId;

  const disputeFoxUrl = resolveDisputeFoxIntakeUrl({
    externalDisputeFoxId: dfId,
    grantsClientId: row.client.grantsClientId,
  });

  return NextResponse.json({
    ok: true,
    grantsClientId: row.client.grantsClientId,
    disputeFoxUrl,
    portalUrl: "/portal",
    // Existing DisputeProcess form preserved as branded fallback when template exists
    fallbackPreserved: Boolean(disputeFoxUrl),
  });
}
