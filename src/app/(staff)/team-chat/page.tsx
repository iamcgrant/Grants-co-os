import { redirect } from "next/navigation";

/** Dedicated Team Chat entry — routes into Inbox team mode */
export default function TeamChatPage() {
  redirect("/inbox?tab=team");
}
