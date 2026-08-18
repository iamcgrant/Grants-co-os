/**
 * Credit Karma — client-assisted score entry only.
 * Never scrape, never apply for credit, never click offers, never change CK settings.
 */

import { CreditBureau } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { addTimelineEvent } from "@/lib/clients/timeline";

export const CREDIT_KARMA_ASSISTED_SOURCE = "CREDIT_KARMA_ASSISTED";

export type AssistedKarmaScoreInput = {
  bureau: "EQUIFAX" | "TRANSUNION" | "EXPERIAN";
  score: number;
  scoringModel?: string;
};

function bureauFromInput(value: AssistedKarmaScoreInput["bureau"]): CreditBureau {
  switch (value) {
    case "EQUIFAX":
      return CreditBureau.EQUIFAX;
    case "TRANSUNION":
      return CreditBureau.TRANSUNION;
    case "EXPERIAN":
      return CreditBureau.EXPERIAN;
    default: {
      const _never: never = value;
      return _never;
    }
  }
}

export async function recordAssistedCreditKarmaScores(input: {
  clientId: string;
  actorId: string;
  scores: AssistedKarmaScoreInput[];
  notes?: string;
}) {
  const client = await prisma.client.findFirst({
    where: { OR: [{ id: input.clientId }, { grantsClientId: input.clientId }] },
  });
  if (!client) throw new Error("Client not found");
  if (!input.scores.length) throw new Error("At least one score is required");

  for (const score of input.scores) {
    if (!Number.isInteger(score.score) || score.score < 300 || score.score > 850) {
      throw new Error("Score must be an integer between 300 and 850");
    }
  }

  const capturedAt = new Date();
  const snapshot = await prisma.creditSnapshot.create({
    data: {
      clientId: client.id,
      source: CREDIT_KARMA_ASSISTED_SOURCE,
      capturedAt,
      summaryJson: JSON.stringify({
        assisted: true,
        scrape: false,
        notes: input.notes || null,
        actorId: input.actorId,
      }),
    },
  });

  const created = [];
  for (const row of input.scores) {
    created.push(
      await prisma.creditScore.create({
        data: {
          clientId: client.id,
          snapshotId: snapshot.id,
          bureau: bureauFromInput(row.bureau),
          score: row.score,
          scoringModel: row.scoringModel?.trim() || "VantageScore 3.0",
          source: CREDIT_KARMA_ASSISTED_SOURCE,
          capturedAt,
        },
      }),
    );
  }

  await prisma.creditConnection.upsert({
    where: { clientId_provider: { clientId: client.id, provider: "CREDIT_KARMA" } },
    create: {
      clientId: client.id,
      provider: "CREDIT_KARMA",
      status: "ASSISTED",
      lastSyncedAt: capturedAt,
    },
    update: {
      status: "ASSISTED",
      lastSyncedAt: capturedAt,
    },
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "CREDIT_KARMA_ASSISTED_SCORES",
    entityType: "Client",
    entityId: client.id,
    metadata: {
      source: CREDIT_KARMA_ASSISTED_SOURCE,
      bureaus: input.scores.map((s) => s.bureau),
      scrape: false,
    },
  });

  await addTimelineEvent({
    clientId: client.id,
    actorId: input.actorId,
    eventType: "CREDIT_KARMA_ASSISTED",
    title: "Credit Karma scores recorded (client-assisted)",
    description: input.scores.map((s) => `${s.bureau} ${s.score}`).join(" · "),
  });

  return { snapshotId: snapshot.id, scores: created, grantsClientId: client.grantsClientId };
}

export async function lastAssistedKarmaAt(): Promise<Date | null> {
  const row = await prisma.creditScore.findFirst({
    where: { source: CREDIT_KARMA_ASSISTED_SOURCE },
    orderBy: { capturedAt: "desc" },
    select: { capturedAt: true },
  });
  return row?.capturedAt || null;
}
