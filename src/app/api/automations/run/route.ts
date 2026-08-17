import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { drainAutomationQueue, scheduleFridayCreditPulse } from "@/lib/automations/engine";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const isCron =
    req.headers.get("x-gc-cron-secret") &&
    req.headers.get("x-gc-cron-secret") === process.env.GC_CRON_SECRET;

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
