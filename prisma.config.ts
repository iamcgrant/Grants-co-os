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
    path: isPostgres ? "prisma/migrations-postgres" : "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
