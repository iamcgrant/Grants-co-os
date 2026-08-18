import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { drainAutomationQueue, scheduleFridayCreditPulse } from "@/lib/automations/engine";

function isAuthorizedCron(req: Request): boolean {
  const expected = process.env.GC_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!expected) return false;

  const headerSecret = req.headers.get("x-gc-cron-secret")?.trim();
  if (headerSecret && headerSecret === expected) return true;

  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set.
  const auth = req.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    const vercelCron = process.env.CRON_SECRET?.trim() || expected;
    if (token && token === vercelCron) return true;
  }

  return false;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const isCron = isAuthorizedCron(req);

  if (!isCron && (!user || !hasPermission(user.role, "MANAGE_OPERATIONS"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action === "friday_pulse") {
    const run = await scheduleFridayCreditPulse();
    const drained = await drainAutomationQueue(10);
    return NextResponse.json({ scheduled: run, drained: drained.length });
  }

  const drained = await drainAutomationQueue(50);
  return NextResponse.json({ drained: drained.length });
}
