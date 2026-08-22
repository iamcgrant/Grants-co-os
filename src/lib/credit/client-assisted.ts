/**
 * Server-only Credit Karma write path. Client Components must import
 * CLIENT_ASSISTED_SOURCE from client-assisted-source.ts, not this file.
 */
import type { CreditBureau } from "@/generated/prisma/client";
import { CLIENT_ASSISTED_SOURCE } from "@/lib/credit/client-assisted-source";
import { prisma } from "@/lib/db/prisma";

export { CLIENT_ASSISTED_SOURCE };

export function parseAssistedBureau(value: string): CreditBureau {
  switch (value) {
    case "EQUIFAX":
    case "EXPERIAN":
    case "TRANSUNION":
      return value;
    default:
      throw new Error("Bureau must be EQUIFAX, EXPERIAN, or TRANSUNION");
  }
}

export async function recordClientAssistedScore(input: {
  clientId: string;
  bureau: CreditBureau;
  score: number;
  scoringModel: string;
}) {
  if (!Number.isInteger(input.score) || input.score < 300 || input.score > 900) {
    throw new Error("Score must be an integer between 300 and 900");
  }
  const model = input.scoringModel.trim();
  if (!model) throw new Error("Scoring model is required");

  const client = await prisma.client.findFirst({
    where: { OR: [{ id: input.clientId }, { grantsClientId: input.clientId }] },
    select: { id: true },
  });
  if (!client) throw new Error("Client not found");

  return prisma.creditScore.create({
    data: {
      clientId: client.id,
      bureau: input.bureau,
      score: input.score,
      scoringModel: model,
      source: CLIENT_ASSISTED_SOURCE,
    },
  });
}
