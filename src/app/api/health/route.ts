import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments/provider";
import { isCommasConfigured } from "@/lib/payments/commas-config";
import { detectDatabaseEngine } from "@/lib/system/database-engine";
import { getProductionDatabaseRefusal } from "@/lib/db/production-guard";

/** Public liveness probe — no secrets, no PII. Must not load native sqlite on Vercel. */
export async function GET() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "") || null;
  const databaseEngine = detectDatabaseEngine();
  const refusal = getProductionDatabaseRefusal();
  const paymentProvider = getPaymentProvider().name;
  const commasConfigured = isCommasConfigured();

  if (refusal) {
    return NextResponse.json({
      ok: false,
      service: "grants-co-os",
      database: "error",
      databaseEngine,
      databaseReason: refusal,
      paymentProvider,
      commasConfigured,
      appUrl,
      time: new Date().toISOString(),
    });
  }

  let database: "ok" | "error" = "ok";
  try {
    const { prisma } = await import("@/lib/db/prisma");
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  return NextResponse.json({
    ok: database === "ok",
    service: "grants-co-os",
    database,
    databaseEngine,
    databaseReason: database === "ok" ? null : "Database query failed",
    paymentProvider,
    commasConfigured,
    appUrl,
    time: new Date().toISOString(),
  });
}
