import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payments/provider";
import { isCommasConfigured } from "@/lib/payments/commas-config";
import { detectDatabaseEngine } from "@/lib/system/database-engine";

/** Public liveness probe — no secrets, no PII. */
export async function GET() {
  let database: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "") || null;
  const databaseEngine = detectDatabaseEngine();

  return NextResponse.json({
    ok: database === "ok",
    service: "grants-co-os",
    database,
    databaseEngine,
    paymentProvider: getPaymentProvider().name,
    commasConfigured: isCommasConfigured(),
    appUrl,
    time: new Date().toISOString(),
  });
}
