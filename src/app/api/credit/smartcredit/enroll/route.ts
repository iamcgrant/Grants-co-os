import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { MockSmartCreditProvider } from "@/lib/credit/pulse";
import { getSmartCreditSponsorConfig } from "@/lib/credit/smartcredit-sponsor";
import { addTimelineEvent } from "@/lib/clients/timeline";

const schema = z.object({
  clientId: z.string(),
});

/**
 * Start SmartCredit sponsored enrollment for a Grants client.
 * Attribution comes from SMARTCREDIT_SPONSOR_URL / SMARTCREDIT_SPONSOR_CODE — never hard-coded.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_CREDIT");
    const body = schema.parse(await req.json());

    const client = await prisma.client.findFirst({
      where: { OR: [{ id: body.clientId }, { grantsClientId: body.clientId }] },
    });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const sponsor = getSmartCreditSponsorConfig();
    const provider = new MockSmartCreditProvider();
    const enrollment = await provider.enrollSponsored(
      client.id,
      client.grantsClientId,
      sponsor.sponsorCode || undefined,
    );

    await prisma.creditConnection.upsert({
      where: {
        clientId_provider: { clientId: client.id, provider: "SMARTCREDIT" },
      },
      create: {
        clientId: client.id,
        provider: "SMARTCREDIT",
        status: "PENDING_ENROLLMENT",
        externalId: enrollment.externalId,
      },
      update: {
        status: "PENDING_ENROLLMENT",
        externalId: enrollment.externalId,
      },
    });

    await addTimelineEvent({
      clientId: client.id,
      actorId: user.id,
      eventType: "SMARTCREDIT_ENROLLMENT_STARTED",
      title: "SmartCredit Enrollment Started",
      description: "Sponsored signup link generated",
      idempotencyKey: `sc_enroll:${client.id}:${enrollment.externalId}`,
    });

    return NextResponse.json({
      enrollmentUrl: enrollment.enrollmentUrl,
      sponsorConfigured: Boolean(sponsor.sponsorUrl || sponsor.sponsorCode),
      message: sponsor.sponsorUrl || sponsor.sponsorCode
        ? "Sponsored enrollment link ready"
        : "Sponsor link not configured yet — set SMARTCREDIT_SPONSOR_URL to preserve affiliate payouts",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
