import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { createCase, listCasesForChannel } from "@/lib/disputes/cases";
import { isDisputeChannel } from "@/lib/disputes/channels";

const createSchema = z.object({
  clientId: z.string().min(1),
  channel: z.string().min(1),
  title: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "VIEW_CREDIT_DOCS");
    const channel = new URL(req.url).searchParams.get("channel") || "";
    if (!isDisputeChannel(channel)) {
      return NextResponse.json({ error: "Unknown channel" }, { status: 400 });
    }
    const cases = await listCasesForChannel(channel);
    return NextResponse.json({ cases });
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
    const body = createSchema.parse(await req.json());
    if (!isDisputeChannel(body.channel)) {
      return NextResponse.json({ error: "Unknown channel" }, { status: 400 });
    }
    const disputeCase = await createCase({
      clientId: body.clientId,
      channel: body.channel,
      title: body.title,
      actorId: user.id,
    });
    return NextResponse.json({ case: disputeCase });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
