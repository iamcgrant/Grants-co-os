import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { TelegramTeamInbox } from "@/components/team/TelegramTeamInbox";

export default async function TeamChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="gc-fade-up space-y-6">
      <div>
        <p className="gc-eyebrow mb-2">Staff only</p>
        <h1 className="text-3xl md:text-4xl mb-2">Telegram</h1>
        <p className="gc-section-sub">
          Telegram threads with Simon / CS / disputes. Fail-closed without TELEGRAM_BOT_TOKEN.
          This is not a client channel and is never routed through GHL.
        </p>
      </div>
      <TelegramTeamInbox />
    </div>
  );
}
