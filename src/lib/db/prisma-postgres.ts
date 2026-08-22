/**
 * Server-only Postgres adapter. Imported only from prisma.ts, never from
 * Client Components, so `pg` / `net` stay out of the browser bundle.
 */
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export function createPostgresPrismaClient(url: string): PrismaClient {
  const pool = new Pool({ connectionString: url });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}
