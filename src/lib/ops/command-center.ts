import { prisma } from "@/lib/db/prisma";
import { getFinanceDashboard } from "@/lib/payments/dashboard";
import { startOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";
import { getGcEnvironment } from "@/lib/integrations/env";
import { isGhlApiReady } from "@/lib/integrations/ghl/http";
import { integrationCredentialStatus } from "@/lib/integrations/credentials";

const clientQueueInclude = {
  identifiers: { select: { provider: true, externalId: true, metadataJson: true } },
  assignments: {
    include: { staff: { select: { firstName: true, lastName: true, role: true } } },
  },
} as const;

export function clientSourceLabel(identifiers: { provider: string; metadataJson: string | null }[]) {
  const ghl = identifiers.find((i) => i.provider === "GHL");
  if (ghl?.metadataJson?.includes('"source":"ghl_api"')) return "GHL live";
  if (ghl) return "Dev sample";
  return "Grants";
}

export async function getOwnerCommandCenter() {
  const now = new Date();
  const today = startOfDay(now);
  const week = startOfWeek(now, { weekStartsOn: 1 });
  const month = startOfMonth(now);

  const finance = await getFinanceDashboard();

  const [
    activeClients,
    newClients,
    waitingOnClient,
    readyForSimon,
    readyForJona,
    stuckClients,
    simonOpen,
    jonaOpen,
    overdueTasks,
    completedToday,
    unreadClientMessages,
    internalUnread,
    integrations,
    pulsePending,
    pulseFailed,
    ghlLiveLinked,
  ] = await Promise.all([
    prisma.client.count({ where: { status: "ACTIVE" } }),
    prisma.client.count({ where: { createdAt: { gte: week } } }),
    prisma.client.count({ where: { stage: "WAITING_ON_CLIENT" } }),
    prisma.client.count({ where: { stage: { in: ["ONBOARDING", "WAITING_ON_CLIENT"] }, nextActionOwner: "SIMON" } }),
    prisma.client.count({ where: { stage: "READY_FOR_PROCESSING", nextActionOwner: "JONA" } }),
    prisma.client.count({
      where: {
        OR: [
          { urgency: { in: ["HIGH", "CRITICAL"] } },
          { nextDueAt: { lt: today } },
        ],
        status: "ACTIVE",
      },
    }),
    prisma.task.count({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
        assignee: { role: "CUSTOMER_SERVICE" },
      },
    }),
    prisma.task.count({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
        assignee: { role: "FILE_PREPARER" },
      },
    }),
    prisma.task.count({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
        dueAt: { lt: today },
      },
    }),
    prisma.task.count({
      where: { status: "DONE", updatedAt: { gte: today } },
    }),
    prisma.message.count({
      where: {
        isInternal: false,
        conversation: { kind: "CLIENT" },
        createdAt: { gte: subDays(now, 7) },
        deliveryStatus: { in: ["RECORDED", "DELIVERED", "SENT"] },
      },
    }),
    prisma.message.count({
      where: { isInternal: true, createdAt: { gte: subDays(now, 7) } },
    }),
    prisma.integrationConnection.findMany({ orderBy: { provider: "asc" } }),
    prisma.fridayPulseItem.count({ where: { updateStatus: "PENDING" } }),
    prisma.fridayPulseItem.count({ where: { updateStatus: "FAILED" } }),
    prisma.clientIdentifier.count({
      where: { provider: "GHL", metadataJson: { contains: '"source":"ghl_api"' } },
    }),
  ]);

  const attention = await prisma.client.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { urgency: { in: ["HIGH", "CRITICAL"] } },
        { nextDueAt: { lt: now } },
        { stage: { in: ["CLIENT_ACTION_REQUIRED", "WAITING_ON_CLIENT"] } },
      ],
    },
    orderBy: [{ urgency: "desc" }, { nextDueAt: "asc" }],
    take: 8,
    select: {
      id: true,
      grantsClientId: true,
      firstName: true,
      lastName: true,
      stage: true,
      nextAction: true,
      nextActionOwner: true,
      urgency: true,
      nextDueAt: true,
      identifiers: { select: { provider: true, metadataJson: true } },
    },
  });

  const recentScores = await prisma.creditChange.findMany({
    orderBy: { detectedAt: "desc" },
    take: 6,
  });

  // Last 14 days collected for trend chart (real transaction sums)
  const fourteenDaysAgo = subDays(today, 13);
  const recentTxns = await prisma.paymentTransaction.findMany({
    where: { status: "SUCCEEDED", createdAt: { gte: fourteenDaysAgo } },
    select: { amountCents: true, createdAt: true },
  });
  const dayKeys: string[] = [];
  const dayTotals: number[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = subDays(today, i);
    const key = d.toISOString().slice(0, 10);
    dayKeys.push(key.slice(5));
    const sum = recentTxns
      .filter((t) => t.createdAt.toISOString().slice(0, 10) === key)
      .reduce((s, t) => s + t.amountCents, 0);
    dayTotals.push(sum);
  }

  const stageGroups = await prisma.client.groupBy({
    by: ["stage"],
    where: { status: "ACTIVE" },
    _count: { _all: true },
  });

  const simonDueToday = await prisma.task.count({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
      assignee: { role: "CUSTOMER_SERVICE" },
      dueAt: { gte: today, lt: new Date(today.getTime() + 86400000) },
    },
  });
  const jonaDueToday = await prisma.task.count({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
      assignee: { role: "FILE_PREPARER" },
      dueAt: { gte: today, lt: new Date(today.getTime() + 86400000) },
    },
  });

  const creds = integrationCredentialStatus();
  const ghlReady = isGhlApiReady();

  return {
    finance,
    ops: {
      activeClients,
      newClients,
      waitingOnClient,
      readyForSimon,
      readyForJona,
      stuckClients,
      ghlLiveLinked,
    },
    team: {
      simonOpen,
      jonaOpen,
      overdueTasks,
      completedToday,
      simonDueToday,
      jonaDueToday,
    },
    communication: {
      unreadClientMessages,
      internalUnread,
      pulsePending,
      pulseFailed,
    },
    integrations,
    integrationHealth: {
      dataPlane: getGcEnvironment(),
      ghlReady,
      ghlLiveLinked,
      disputeFoxReady: creds.disputeFoxApi,
      smartCreditSponsor: creds.smartCreditSponsor,
    },
    attention,
    recentScores,
    revenueTrend: { labels: dayKeys, values: dayTotals },
    stageBreakdown: stageGroups.map((g) => ({ stage: g.stage, count: g._count._all })),
    generatedAt: now.toISOString(),
    window: { today: today.toISOString(), week: week.toISOString(), month: month.toISOString() },
  };
}

export async function getSimonCareBoard(simonUserId: string) {
  const today = startOfDay(new Date());
  const clients = await prisma.client.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { nextActionOwner: "SIMON" },
        { assignments: { some: { staffId: simonUserId } } },
        { stage: { in: ["WAITING_ON_CLIENT", "RESULTS_RECEIVED", "CLIENT_ACTION_REQUIRED", "ONBOARDING"] } },
      ],
    },
    orderBy: [{ urgency: "desc" }, { nextDueAt: "asc" }],
    include: {
      ...clientQueueInclude,
      tasks: {
        where: { status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] }, assigneeId: simonUserId },
        take: 3,
      },
    },
  });

  const buckets = {
    needsFollowUp: clients.filter((c) =>
      ["WAITING_ON_CLIENT", "ONBOARDING", "CLIENT_ACTION_REQUIRED"].includes(c.stage),
    ),
    resultsToDeliver: clients.filter((c) => c.stage === "RESULTS_RECEIVED"),
    readyForJona: clients.filter((c) => c.stage === "READY_FOR_PROCESSING" || c.nextActionOwner === "JONA"),
    dueToday: clients.filter((c) => c.nextDueAt && c.nextDueAt <= new Date(today.getTime() + 86400000)),
    overdue: clients.filter((c) => c.nextDueAt && c.nextDueAt < today),
  };

  return { clients, buckets };
}

export async function getJonaProcessingBoard(jonaUserId: string) {
  const clients = await prisma.client.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { nextActionOwner: "JONA" },
        { assignments: { some: { staffId: jonaUserId } } },
        {
          stage: {
            in: [
              "READY_FOR_PROCESSING",
              "FILE_PREPARATION",
              "ROUND_SUBMITTED",
              "WAITING_FOR_RESULTS",
              "RESULTS_RECEIVED",
              "NEXT_ROUND",
            ],
          },
        },
      ],
    },
    orderBy: [{ urgency: "desc" }, { nextDueAt: "asc" }],
    include: {
      ...clientQueueInclude,
      disputeRounds: { orderBy: { roundNumber: "desc" }, take: 2 },
      tasks: {
        where: { status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] }, assigneeId: jonaUserId },
        take: 3,
      },
    },
  });

  const byStage = (stage: string) => clients.filter((c) => c.stage === stage);

  return {
    clients,
    queues: {
      readyForProcessing: byStage("READY_FOR_PROCESSING"),
      fileReview: byStage("FILE_PREPARATION"),
      submitted: byStage("ROUND_SUBMITTED"),
      waitingResults: byStage("WAITING_FOR_RESULTS"),
      resultsReceived: byStage("RESULTS_RECEIVED"),
      nextRound: byStage("NEXT_ROUND"),
      returnToSimon: clients.filter((c) => c.nextActionOwner === "SIMON" && c.stage === "CLIENT_ACTION_REQUIRED"),
      overdue: clients.filter((c) => c.nextDueAt && c.nextDueAt < startOfDay(new Date())),
    },
  };
}
