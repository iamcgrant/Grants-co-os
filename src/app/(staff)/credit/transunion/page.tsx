import { ChannelCasesView } from "@/components/disputes/ChannelCasesView";
import { requireCreditStaff } from "@/lib/disputes/access";

export default async function TransUnionCasesPage() {
  const { user, denied } = await requireCreditStaff();
  if (denied || !user) return <p>Access denied.</p>;
  return <ChannelCasesView channel="TRANSUNION" user={user} />;
}
