import { prisma } from "@/lib/db/prisma";

export async function getOperationsDashboard(staffId?: string) {
  const [
    openTasks,
    paymentIssues,
    missingDocs,
    creditUpdates,
    followUps,
    assignments,
    workload,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        ...(staffId ? { assigneeId: staffId } : {}),
      },
      include: {
        client: { select: { grantsClientId: true, firstName: true, lastName: true } },
        assignee: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      take: 50,
    }),
    prisma.task.count({ where: { category: "PAYMENT_ISSUES", status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.task.count({ where: { category: "MISSING_DOCUMENTS", status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.task.count({ where: { category: "CREDIT_UPDATES", status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.task.count({ where: { category: "CLIENT_FOLLOW_UPS", status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.clientAssignment.findMany({
      include: {
        client: { select: { grantsClientId: true, firstName: true, lastName: true } },
        staff: { select: { firstName: true, lastName: true, role: true } },
      },
      take: 40,
    }),
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, assigneeId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const staffIds = workload.map((w) => w.assigneeId!).filter(Boolean);
  const staff = await prisma.user.findMany({
    where: { id: { in: staffIds } },
    select: { id: true, firstName: true, lastName: true, role: true },
  });

  return {
    queues: {
      paymentIssues,
      missingDocuments: missingDocs,
      creditUpdates,
      followUps,
      openTasks: openTasks.length,
    },
    tasks: openTasks,
    assignments,
    workload: workload.map((w) => ({
      staff: staff.find((s) => s.id === w.assigneeId),
      openCount: w._count._all,
    })),
  };
}
