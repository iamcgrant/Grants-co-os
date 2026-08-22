import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { sendGhlClientMessage } from "@/lib/integrations/ghl/workspace";

const schema = z.object({
  clientId: z.string().min(1),
  channel: z.enum(["SMS", "Email"]),
  body: z.string().min(1).max(8000),
  subject: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "VIEW_INBOX");
    if (user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const result = await sendGhlClientMessage({
      clientId: parsed.data.clientId,
      senderId: user.id,
      channel: parsed.data.channel,
      body: parsed.data.body,
      subject: parsed.data.subject,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.actionRequired || "Outbound send failed — ACTION_REQUIRED",
          deliveryStatus: result.deliveryStatus,
          requiredScope: result.requiredScope,
          actionRequired: true,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
