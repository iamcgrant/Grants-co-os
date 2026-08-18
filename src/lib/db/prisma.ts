import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";
import {
  getProductionDatabaseRefusal,
  isProductionPostgresUrl,
  ProductionDatabaseNotConfigured,
} from "@/lib/db/production-guard";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const refusal = getProductionDatabaseRefusal();
  if (refusal) {
    throw new ProductionDatabaseNotConfigured(refusal);
  }

  const url = process.env.DATABASE_URL || "";

  if (isProductionPostgresUrl(url)) {
    // Production / Vercel + Neon path. Generated with prisma/schema.postgres.prisma.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- pg adapter is only needed for postgres URLs
    const { Pool } = require("pg") as typeof import("pg");
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- PrismaPg must not load unless DATABASE_URL is postgres
    const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg");
    const pool = new Pool({ connectionString: url });
    return new PrismaClient({ adapter: new PrismaPg(pool) });
  }

  /**
   * Local Cloud Agent / Vitest — sqlite adapter.
   * Inline require is the documented native-module exception to no-inline-imports:
   * a top-level import of `@prisma/adapter-better-sqlite3` loads `better_sqlite3.node`
   * and crashes Vercel `/var/task` even before DATABASE_URL is inspected.
   * Keep the specifier static so Next/Turbopack can resolve it; the Vercel
   * guard above ensures this branch never runs on serverless.
   */
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3") as typeof import("@prisma/adapter-better-sqlite3");

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

function loadPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Lazy Prisma accessor. Importing this module must not load native sqlite
 * addons or throw when Vercel has no postgres URL — `/api/health` has to stay up.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = loadPrisma();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});

export type { PrismaClient };
