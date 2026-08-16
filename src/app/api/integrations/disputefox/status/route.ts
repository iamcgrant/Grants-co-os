import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { integrationCredentialStatus } from "@/lib/integrations/credentials";
import { isDisputeFoxApiReady } from "@/lib/integrations/disputefox/http";
import { DISPUTEFOX_ZAP_ENABLED, DISPUTEFOX_ZAP_ID } from "@/lib/integrations/disputefox/secrets";
import { getGcEnvironment } from "@/lib/integrations/env";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user.role, "VIEW_CLIENT");

    const connection = await prisma.integrationConnection.findUnique({
      where: { provider: "disputefox" },
    });

    const liveLinked = await prisma.clientIdentifier.count({
      where: {
        provider: "DISPUTEFOX",
        metadataJson: { contains: '"source":"disputefox_api"' },
      },
    });

    const flags = integrationCredentialStatus();

    return NextResponse.json({
      dataPlane: getGcEnvironment(),
      ready: isDisputeFoxApiReady(),
      status: isDisputeFoxApiReady()
        ? connection?.status === "CONNECTED"
          ? "CONNECTED"
          : "READY"
        : connection?.status === "LOCAL_ROSTER"
          ? "LOCAL_ROSTER"
          : "AWAITING_INTEGRATION",
      lastSyncAt: connection?.lastSyncAt ?? null,
      liveLinkedClients: liveLinked,
      credentials: {
        portal: flags.disputeFoxPortal,
        apiKey: flags.disputeFoxApi,
      },
      envNames: {
        disputeFoxApiKey: flags.envNames.disputeFoxApiKey,
      },
      inbound: {
        existingMasterRecordsOnly: true,
        matchOrder: ["email", "normalized_phone"],
        createDisputeFoxRecords: false,
        inventDfIds: false,
        zapId: DISPUTEFOX_ZAP_ID,
        zapEnabled: DISPUTEFOX_ZAP_ENABLED,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
