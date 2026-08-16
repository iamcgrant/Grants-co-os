import { CreditBureau } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { addTimelineEvent } from "@/lib/clients/timeline";

export interface SmartCreditProvider {
  readonly name: "smartcredit";
  enrollSponsored(clientId: string, sponsorCode?: string): Promise<{ externalId: string; enrollmentUrl: string }>;
  fetchScores(externalId: string): Promise<
    { bureau: CreditBureau; score: number; scoringModel: string }[]
  >;
}

export class MockSmartCreditProvider implements SmartCreditProvider {
  readonly name = "smartcredit" as const;

  async enrollSponsored(clientId: string, sponsorCode = "GRANTSCO") {
    return {
      externalId: `sc_${clientId.slice(0, 8)}`,
      enrollmentUrl: `https://smartcredit.example/enroll?sponsor=${sponsorCode}&ref=${clientId}`,
    };
  }

  async fetchScores(externalId: string) {
    // Deterministic mock based on id hash
    const seed = externalId.length * 7;
    return [
      { bureau: CreditBureau.EQUIFAX, score: 620 + (seed % 40), scoringModel: "VantageScore 3.0" },
      { bureau: CreditBureau.EXPERIAN, score: 630 + (seed % 35), scoringModel: "VantageScore 3.0" },
      { bureau: CreditBureau.TRANSUNION, score: 615 + (seed % 45), scoringModel: "VantageScore 3.0" },
    ];
  }
}

/**
 * Credit Karma — READ ONLY connector.
 * Never apply for credit, click offers, file disputes, or alter settings.
 */
export interface CreditKarmaConnector {
  readonly name: "credit_karma";
  readonly readOnly: true;
  fetchWeeklyScores(credentialRef: string): Promise<
    { bureau: "EQUIFAX" | "TRANSUNION"; score: number; scoringModel: string; updatedAt: string }[]
  >;
}

export class MockCreditKarmaConnector implements CreditKarmaConnector {
  readonly name = "credit_karma" as const;
  readonly readOnly = true as const;

  async fetchWeeklyScores(credentialRef: string) {
    void credentialRef;
    return [
      {
        bureau: "EQUIFAX" as const,
        score: 660,
        scoringModel: "VantageScore 3.0",
        updatedAt: new Date().toISOString(),
      },
      {
        bureau: "TRANSUNION" as const,
        score: 641,
        scoringModel: "VantageScore 3.0",
        updatedAt: new Date().toISOString(),
      },
    ];
  }
}

export interface ExperianConnector {
  readonly name: "experian";
  fetchWeeklyScore(credentialRef: string): Promise<{
    bureau: "EXPERIAN";
    score: number;
    scoringModel: string;
    updatedAt: string;
  }>;
}

export class MockExperianConnector implements ExperianConnector {
  readonly name = "experian" as const;

  async fetchWeeklyScore(credentialRef: string) {
    void credentialRef;
    return {
      bureau: "EXPERIAN" as const,
      score: 682,
      scoringModel: "FICO Score 8",
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function recordCreditSnapshot(input: {
  clientId: string;
  source: string;
  scores: { bureau: CreditBureau; score: number; scoringModel: string }[];
}) {
  const snapshot = await prisma.creditSnapshot.create({
    data: {
      clientId: input.clientId,
      source: input.source,
      summaryJson: JSON.stringify(input.scores),
      scores: {
        create: input.scores.map((s) => ({
          clientId: input.clientId,
          bureau: s.bureau,
          score: s.score,
          scoringModel: s.scoringModel,
          source: input.source,
        })),
      },
    },
    include: { scores: true },
  });

  // Detect changes vs previous scores per bureau+model
  for (const score of snapshot.scores) {
    const previous = await prisma.creditScore.findFirst({
      where: {
        clientId: input.clientId,
        bureau: score.bureau,
        scoringModel: score.scoringModel,
        id: { not: score.id },
      },
      orderBy: { capturedAt: "desc" },
    });

    if (previous && previous.score !== score.score) {
      await prisma.creditChange.create({
        data: {
          clientId: input.clientId,
          bureau: score.bureau,
          previousScore: previous.score,
          newScore: score.score,
          scoringModel: score.scoringModel,
          source: input.source,
          changeAmount: score.score - previous.score,
        },
      });
    }
  }

  await addTimelineEvent({
    clientId: input.clientId,
    eventType: "SCORE_UPDATED",
    title: "Credit Scores Updated",
    description: `Snapshot from ${input.source}`,
    idempotencyKey: `credit_snap:${snapshot.id}`,
  });

  return snapshot;
}

/**
 * Friday Credit Pulse — weekly update infrastructure.
 */
export async function runFridayCreditPulse(clientId: string) {
  const connections = await prisma.creditConnection.findMany({
    where: { clientId, status: "CONNECTED" },
  });

  const smartcredit = new MockSmartCreditProvider();
  const karma = new MockCreditKarmaConnector();
  const experian = new MockExperianConnector();

  const allScores: { bureau: CreditBureau; score: number; scoringModel: string }[] = [];
  const notifications: string[] = [];

  for (const conn of connections) {
    if (conn.needsReauth) {
      await prisma.notification.create({
        data: {
          clientId,
          channel: "IN_APP",
          title: `${conn.provider} needs reconnection`,
          body: "Tap to reconnect securely. No staff action required.",
          status: "PENDING",
        },
      });
      notifications.push(`${conn.provider}_REAUTH`);
      continue;
    }

    if (conn.provider === "SMARTCREDIT" && conn.externalId) {
      const scores = await smartcredit.fetchScores(conn.externalId);
      allScores.push(...scores);
    }
    if (conn.provider === "CREDIT_KARMA") {
      const scores = await karma.fetchWeeklyScores(conn.credentialRef || "mock");
      allScores.push(
        ...scores.map((s) => ({
          bureau: s.bureau as CreditBureau,
          score: s.score,
          scoringModel: s.scoringModel,
        })),
      );
    }
    if (conn.provider === "EXPERIAN") {
      const score = await experian.fetchWeeklyScore(conn.credentialRef || "mock");
      allScores.push({
        bureau: CreditBureau.EXPERIAN,
        score: score.score,
        scoringModel: score.scoringModel,
      });
    }

    await prisma.creditConnection.update({
      where: { id: conn.id },
      data: { lastSyncedAt: new Date() },
    });
  }

  let snapshot = null;
  if (allScores.length > 0) {
    snapshot = await recordCreditSnapshot({
      clientId,
      source: "FRIDAY_PULSE",
      scores: allScores,
    });

    const changes = await prisma.creditChange.findMany({
      where: { clientId, detectedAt: { gte: new Date(Date.now() - 60_000) } },
    });

    const summary =
      changes.length === 0
        ? "No score changes this week."
        : changes
            .map(
              (c) =>
                `${c.bureau} ${c.scoringModel}: ${c.previousScore} → ${c.newScore} (${c.changeAmount >= 0 ? "+" : ""}${c.changeAmount})`,
            )
            .join("; ");

    await prisma.notification.create({
      data: {
        clientId,
        channel: "IN_APP",
        title: "Friday Credit Pulse",
        body: summary,
        status: "PENDING",
      },
    });
  }

  return { snapshot, notifications, scoreCount: allScores.length };
}
