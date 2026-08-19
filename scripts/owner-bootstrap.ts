/**
 * Apply OWNER_BOOTSTRAP_PASSWORD to owner@grantsandco.com (or OWNER_EMAIL).
 * Prints email + LOGIN_URL only — never prints the password.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { ensureOwnerPasswordFromEnv } from "../src/lib/auth/owner-bootstrap";
import { getCanonicalOnlineOrigin } from "../src/lib/access/origins";
import { prisma } from "../src/lib/db/prisma";

async function main() {
  const result = await ensureOwnerPasswordFromEnv();
  const origin = getCanonicalOnlineOrigin();
  console.log("=== Owner bootstrap ===");
  console.log(`email: ${result.email}`);
  console.log(`updated: ${result.updated}`);
  console.log(`created: ${result.created}`);
  console.log(`reason: ${result.reason}`);
  console.log(`LOGIN_URL: ${origin}/login`);
  if (!result.updated && result.reason === "OWNER_BOOTSTRAP_PASSWORD not set") {
    process.exit(2);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
