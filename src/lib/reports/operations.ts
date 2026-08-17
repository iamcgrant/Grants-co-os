import { prisma } from "@/lib/db/prisma";

/**
 * Operations reporting — verified revenue only (excludes mock provider from "collected").
 */
export async function getOperationsReport() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const succeededWhere = {
    status: "SUCCEEDED" as const,
    NOT: { provider: "mock" },
  };

  const [today, week, month, unpaid, activeClients, openTasks, unanswered, pulse] =
    await Promise.all([
      prisma.paymentTransaction.aggregate({
        where: { ...succeededWhere, createdAt: { gte: startOfDay } },
        _sum: { amountCents: true },
        _count: true,
      }),
      prisma.paymentTransaction.aggregate({
        where: { ...succeededWhere, createdAt: { gte: startOfWeek } },
        _sum: { amountCents: true },
        _count: true,
      }),
      prisma.paymentTransaction.aggregate({
        where: { ...succeededWhere, createdAt: { gte: startOfMonth } },
        _sum: { amountCents: true },
        _count: true,
      }),
      prisma.invoice.findMany({
        where: { status: { in: ["DUE", "FAILED"] } },
        include: { client: { select: { firstName: true, lastName: true, grantsClientId: true } } },
        take: 25,
        orderBy: { dueAt: "asc" },
      }),
      prisma.client.count({ where: { status: "ACTIVE" } }),
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        _count: true,
      }),
      prisma.message.count({
        where: {
          isInternal: false,
          deliveryStatus: { in: ["RECORDED"] },
          createdAt: { gte: startOfWeek },
        },
      }),
      prisma.fridayPulseRun.findFirst({ orderBy: { createdAt: "desc" } }),
    ]);

  const mockCollected = await prisma.paymentTransaction.aggregate({
    where: { status: "SUCCEEDED", provider: "mock" },
    _sum: { amountCents: true },
    _count: true,
  });

  return {
    revenue: {
      todayCents: today._sum.amountCents || 0,
      todayCount: today._count,
      weekCents: week._sum.amountCents || 0,
      weekCount: week._count,
      monthCents: month._sum.amountCents || 0,
      monthCount: month._count,
      note: "Verified non-mock SUCCEEDED payments only",
    },
    simulatedExcluded: {
      amountCents: mockCollected._sum.amountCents || 0,
      count: mockCollected._count,
    },
    unpaidInvoices: unpaid,
    activeClients,
    openTasksByAssignee: openTasks,
    unansweredInboundThisWeek: unanswered,
    lastFridayPulseAt: pulse?.createdAt?.toISOString() || null,
  };
}
