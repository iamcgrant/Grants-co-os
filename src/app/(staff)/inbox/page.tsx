import { GuardedPortalDesk } from "@/components/desk/GuardedPortalDesk";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  if (tab === "gmail") return GuardedPortalDesk({ deskId: "gmail", gate: "staff" });
  if (tab === "ghl") return GuardedPortalDesk({ deskId: "ghl", gate: "staff" });
  return GuardedPortalDesk({ deskId: "ghl-inbox", gate: "staff" });
}
