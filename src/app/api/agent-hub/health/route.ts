import { NextResponse } from "next/server";
import {
  getAgentCapabilities,
  getBusinessConfiguration,
  getSystemHealth,
  getGhlSchema,
  getDisputeFoxMapping,
  bootstrapAgentHub,
} from "@/lib/agent-hub";

/** Public read-only hub health for MCP bootstrap (no secrets). */
export async function GET() {
  await bootstrapAgentHub();
  const [capabilities, health, business, ghl, df] = await Promise.all([
    getAgentCapabilities(),
    getSystemHealth(),
    getBusinessConfiguration(),
    getGhlSchema(),
    getDisputeFoxMapping(),
  ]);
  return NextResponse.json({
    ok: true,
    name: "grants-agent-hub",
    capabilities,
    health,
    businessFactCount: Array.isArray(business) ? business.length : 0,
    ghlFieldCount: Array.isArray(ghl.fields) ? ghl.fields.length : 0,
    disputeFox: df.intake,
  });
}
