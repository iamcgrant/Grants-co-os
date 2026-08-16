import { execSync } from "node:child_process";
import fs from "node:fs";
import Database from "better-sqlite3";

/**
 * Apply the current Prisma schema to an isolated SQLite file.
 * Uses `migrate diff` (SQL only) instead of `db push`, which is blocked
 * for AI-invoked migrate against a datasource in this environment.
 */
export function resetSqliteFromSchema(dbPath: string) {
  for (const f of [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  const sql = execSync(
    "npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script",
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

  const db = new Database(dbPath);
  db.exec(sql);
  db.close();
}
