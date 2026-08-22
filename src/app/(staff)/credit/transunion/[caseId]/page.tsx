import { ChannelCaseDetail } from "@/components/disputes/ChannelCaseDetail";
import { requireCreditStaff } from "@/lib/disputes/access";

export default async function TransUnionCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { user, denied } = await requireCreditStaff();
  if (denied || !user) return <p>Access denied.</p>;
  const { caseId } = await params;
  return <ChannelCaseDetail caseId={caseId} user={user} />;
}
