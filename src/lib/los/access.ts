import type { AuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { LosHttpError } from "./errors";

export async function clientIdForUser(userId: string): Promise<string | null> {
  const client = await prisma.client.findFirst({ where: { userId }, select: { id: true } });
  return client?.id ?? null;
}

export async function assertApplicationAccess(user: AuthUser, applicationId: string) {
  const app = await prisma.mortgageApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, clientId: true },
  });
  if (!app) throw new LosHttpError(404, "APPLICATION_NOT_FOUND");

  if (user.role === "CLIENT") {
    const clientId = await clientIdForUser(user.id);
    if (!clientId || clientId !== app.clientId) {
      throw new LosHttpError(403, "FORBIDDEN", undefined, "Application access denied");
    }
  }
  return app;
}
