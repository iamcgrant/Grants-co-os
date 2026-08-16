import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { integrationCredentialStatus } from "@/lib/integrations/credentials";
import { isGhlApiReady } from "@/lib/integrations/ghl/http";
import { getGcEnvironment } from "@/lib/integrations/env";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user.role, "VIEW_CLIENT");

    const connection = await prisma.integrationConnection.findUnique({
      where: { provider: "gohighlevel" },
    });

    const liveLinked = await prisma.clientIdentifier.count({
      where: {
        provider: "GHL",
        metadataJson: { contains: '"source":"ghl_api"' },
      },
    });

    const flags = integrationCredentialStatus();

    return NextResponse.json({
      dataPlane: getGcEnvironment(),
      ready: isGhlApiReady(),
      status: isGhlApiReady()
        ? connection?.status === "CONNECTED"
          ? "CONNECTED"
          : "READY"
        : "AWAITING_INTEGRATION",
      lastSyncAt: connection?.lastSyncAt ?? null,
      liveLinkedClients: liveLinked,
      credentials: {
        portal: flags.ghlPortal,
        apiKey: flags.ghlApi,
        locationId: flags.ghlLocation,
        live: flags.ghlLive,
      },
      envNames: flags.envNames,
      defaultLocationId: flags.defaultLocationId,
      inbound: {
        existingMasterRecordsOnly: true,
        matchOrder: ["ghl_id", "email", "normalized_phone"],
        createGhlContacts: false,
      },
      // Never expose secret values or hints that embed secrets
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
