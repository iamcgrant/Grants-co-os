import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import {
  listTelegramChatMessages,
  sendTelegramTeamMessage,
} from "@/lib/integrations/telegram/workspace";

const sendSchema = z.object({
  chatId: z.string().min(1),
  body: z.string().min(1).max(4000),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "VIEW_INBOX");
    const chatId = new URL(req.url).searchParams.get("chatId")?.trim();
    if (!chatId) {
      return NextResponse.json({ error: "chatId is required" }, { status: 400 });
    }
    const messages = await listTelegramChatMessages(chatId);
    return NextResponse.json(messages);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user.role, "VIEW_INBOX");
    const parsed = sendSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const sent = await sendTelegramTeamMessage(parsed.data);
    if (!sent.ok) {
      return NextResponse.json(
        { error: sent.reason, requiredEnv: sent.requiredEnv, actionRequired: true },
        { status: 502 },
      );
    }
    return NextResponse.json(sent);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Forbidden") || msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
