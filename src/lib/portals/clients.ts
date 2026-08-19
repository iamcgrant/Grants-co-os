import { prisma } from "@/lib/db/prisma";

export async function listPortalClientOptions() {
  const clients = await prisma.client.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 200,
    select: { id: true, grantsClientId: true, firstName: true, lastName: true },
  });
  return clients.map((c) => ({
    id: c.id,
    grantsClientId: c.grantsClientId,
    name: `${c.firstName} ${c.lastName}`,
  }));
}
