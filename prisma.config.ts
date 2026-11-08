/**
 * Make prisma.config.ts follow DATABASE_URL for generate/migrate.
 * Keeps sqlite default for local; switches schema path for Postgres.
 */
import "dotenv/config";
import { defineConfig } from "prisma/config";

const url = process.env.DATABASE_URL || "";
const isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://");

export default defineConfig({
  schema: isPostgres ? "prisma/schema.postgres.prisma" : "prisma/schema.prisma",
  migrations: {
    // Production uses `prisma db push`, not migrate. The postgres-only
    // folder was never created, and Prisma treats that missing path as ENOENT.
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
