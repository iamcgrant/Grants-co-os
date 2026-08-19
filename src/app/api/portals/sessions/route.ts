import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { isPortalProviderId } from "@/lib/portals/catalog";
import { listPortalSessions, openPortalSession } from "@/lib/portals/service";

const openSchema = z.object({
  provider: z.string(),
  clientId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "VIEW_CREDIT_DOCS");
    const url = new URL(req.url);
    const providerRaw = url.searchParams.get("provider") || undefined;
    const provider = providerRaw && isPortalProviderId(providerRaw) ? providerRaw : undefined;
    const clientId = url.searchParams.get("clientId") || undefined;
    const sessions = await listPortalSessions({ provider, clientId, take: 50 });
    return NextResponse.json({ sessions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "MANAGE_CREDIT");
    const body = openSchema.parse(await req.json());
    if (!isPortalProviderId(body.provider)) {
      return NextResponse.json({ error: "Unknown portal provider" }, { status: 400 });
    }
    const result = await openPortalSession({
      provider: body.provider,
      openedById: user.id,
      clientId: body.clientId,
      notes: body.notes,
    });
    return NextResponse.json({
      session: result.session,
      portalUrl: result.entry.officialUrl,
      launchMode: result.launchMode,
      iframeAllowed: result.entry.iframeAllowed,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
