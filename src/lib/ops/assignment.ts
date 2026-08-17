import { prisma } from "@/lib/db/prisma";

/**
 * Route new paying clients to Simon (care) and Jona (file prep) by default.
 * Idempotent — does not create Ana or duplicate assignments.
 */
export async function assignDefaultStaff(clientId: string) {
  const simon = await prisma.user.findFirst({
    where: { email: "simon@grantsandco.com", role: "CUSTOMER_SERVICE" },
  });
  const jona = await prisma.user.findFirst({
    where: { email: "jona@grantsandco.com", role: "FILE_PREPARER" },
  });

  const created: string[] = [];

  if (simon) {
    const existing = await prisma.clientAssignment.findFirst({
      where: { clientId, staffId: simon.id },
    });
    if (!existing) {
      await prisma.clientAssignment.create({
        data: {
          clientId,
          staffId: simon.id,
          roleLabel: "CUSTOMER_SERVICE",
          isPrimary: true,
        },
      });
      created.push("SIMON");
    }
  }

  if (jona) {
    const existing = await prisma.clientAssignment.findFirst({
      where: { clientId, staffId: jona.id },
    });
    if (!existing) {
      await prisma.clientAssignment.create({
        data: {
          clientId,
          staffId: jona.id,
          roleLabel: "FILE_PREPARER",
          isPrimary: false,
        },
      });
      created.push("JONA");
    }
  }

  await prisma.client.update({
    where: { id: clientId },
    data: {
      stage: "ONBOARDING",
      nextAction: "Complete client setup",
      nextActionOwner: "SIMON",
    },
  });

  if (simon) {
    const open = await prisma.task.count({
      where: { clientId, assigneeId: simon.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
    });
    if (!open) {
      await prisma.task.create({
        data: {
          clientId,
          assigneeId: simon.id,
          createdById: simon.id,
          title: "Welcome + confirm intake",
          description: "New payment received — guide client through setup and documents.",
          status: "OPEN",
          priority: "HIGH",
        },
      });
    }
  }

  if (jona) {
    const open = await prisma.task.count({
      where: { clientId, assigneeId: jona.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
    });
    if (!open) {
      await prisma.task.create({
        data: {
          clientId,
          assigneeId: jona.id,
          createdById: jona.id,
          title: "Prepare file after intake",
          description: "Await intake completion, then begin dispute file preparation.",
          status: "OPEN",
          priority: "MEDIUM",
        },
      });
    }
  }

  return { created };
}
