/**
 * Generate Prisma client for the active DATABASE_URL.
 * - file: / sqlite → prisma/schema.prisma (local Cloud Agent + tests)
 * - postgres* → prisma/schema.postgres.prisma (Vercel production)
 *
 * Does not mutate the local sqlite schema or migrations used by existing tests.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

const url = process.env.DATABASE_URL || "";
const isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://");
const schema = isPostgres ? "prisma/schema.postgres.prisma" : "prisma/schema.prisma";

console.log(`[prisma-generate] provider=${isPostgres ? "postgresql" : "sqlite"} schema=${schema}`);

const result = spawnSync("npx", ["prisma", "generate", `--schema=${schema}`], {
  stdio: "inherit",
  env: process.env,
  shell: false,
});

process.exit(result.status ?? 1);
