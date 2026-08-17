import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payments/provider";
import { isCommasConfigured } from "@/lib/payments/commas-config";

/** Public liveness probe — no secrets, no PII. */
export async function GET() {
  let database: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  return NextResponse.json({
    ok: database === "ok",
    service: "grants-co-os",
    database,
    paymentProvider: getPaymentProvider().name,
    commasConfigured: isCommasConfigured(),
    time: new Date().toISOString(),
  });
}
