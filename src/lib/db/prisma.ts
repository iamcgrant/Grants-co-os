/**
 * Server-only Prisma entry. Never import this module from a Client Component —
 * `pg` and the SQLite adapter must stay out of the browser bundle.
 */
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { createPostgresPrismaClient } from "@/lib/db/prisma-postgres";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function isPostgresUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL || "";

  if (isPostgresUrl(url)) {
    return createPostgresPrismaClient(url);
  }

  // Local Cloud Agent / Vitest — unchanged sqlite adapter path.
  const dbPath =
    url.replace(/^file:/, "") || path.join(process.cwd(), "prisma", "dev.db");

  const absolutePath = path.isAbsolute(dbPath)
    ? dbPath
    : path.join(/*turbopackIgnore: true*/ process.cwd(), dbPath.replace(/^\.\//, ""));

  const adapter = new PrismaBetterSqlite3({
    url: `file:${absolutePath}`,
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type { PrismaClient };
