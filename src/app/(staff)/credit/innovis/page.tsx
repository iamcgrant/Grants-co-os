import { ChannelCasesView } from "@/components/disputes/ChannelCasesView";
import { requireCreditStaff } from "@/lib/disputes/access";

export default async function InnovisCasesPage() {
  const { user, denied } = await requireCreditStaff();
  if (denied || !user) return <p>Access denied.</p>;
  return ChannelCasesView({ channel: "INNOVIS", user });
}
