/**
 * Generate (or refresh) Owner first-time password setup link.
 * Prints URL + confirmation only — never prints the password (Owner chooses it).
 *
 * Usage:
 *   OWNER_SETUP_BASE_URL=https://... npx tsx scripts/owner-setup-link.ts
 */
import dotenv from "dotenv";
// Align with Next.js local `.env` when Cursor injects a different AUTH_SECRET into the shell.
dotenv.config({ path: ".env", override: true });

import { hasPermission, PERMISSIONS, type Permission } from "../src/lib/rbac/permissions";
import {
  buildSetPasswordUrl,
  createPasswordSetupToken,
  ensureOwnerForFirstTimeSetup,
} from "../src/lib/auth/password-setup";
import { prisma } from "../src/lib/db/prisma";
import { Role } from "../src/generated/prisma/client";

async function main() {
  const baseUrl =
    process.env.OWNER_SETUP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://127.0.0.1:3000";

  const email = (process.env.OWNER_EMAIL || "owner@grantsandco.com").toLowerCase();

  const owner = await ensureOwnerForFirstTimeSetup({
    email,
    firstName: process.env.OWNER_FIRST_NAME || "Charles",
    lastName: process.env.OWNER_LAST_NAME || "Grant",
  });

  const { token, expiresAt } = await createPasswordSetupToken({
    userId: owner.id,
    email: owner.email,
  });

  const url = buildSetPasswordUrl(baseUrl, token);

  const allPerms = Object.keys(PERMISSIONS) as Permission[];
  const granted = allPerms.filter((p) => hasPermission(Role.OWNER, p));
  const missing = allPerms.filter((p) => !hasPermission(Role.OWNER, p));

  const dbKind =
    (process.env.DATABASE_URL || "").startsWith("postgres")
      ? "postgresql"
      : "sqlite";

  console.log("=== Owner / Super Admin ready ===");
  console.log(`email: ${owner.email}`);
  console.log(`role: ${owner.role}`);
  console.log(`mustChangePassword: ${owner.mustChangePassword}`);
  console.log(`permissions_granted: ${granted.length}/${allPerms.length}`);
  if (missing.length) {
    console.log(`permissions_not_on_owner (expected client-only): ${missing.join(", ")}`);
  }
  console.log(`database: ${dbKind} (connected)`);
  console.log(`setup_expires: ${expiresAt.toISOString()}`);
  console.log("");
  console.log("SET_PASSWORD_URL:");
  console.log(url);
  console.log("");
  console.log("LOGIN_URL:");
  console.log(`${baseUrl.replace(/\/$/, "")}/login`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
