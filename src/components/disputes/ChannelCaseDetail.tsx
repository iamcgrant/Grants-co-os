import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/rbac/permissions";
import { CaseWorkspace } from "@/components/disputes/CaseWorkspace";
import { getCaseById } from "@/lib/disputes/cases";
import { channelCatalog, isDisputeChannel, statusLabel, type DisputeCaseStatus } from "@/lib/disputes/channels";
import type { AuthUser } from "@/lib/auth/session";

export async function ChannelCaseDetail({
  caseId,
  user,
}: {
  caseId: string;
  user: AuthUser;
}) {
  try {
    const disputeCase = await getCaseById(caseId);
    if (!isDisputeChannel(disputeCase.channel)) notFound();
    const catalog = channelCatalog(disputeCase.channel);
    return (
      <div className="gc-fade-up">
        <p className="gc-eyebrow mb-2">{catalog.eyebrow}</p>
        <h1 className="text-4xl md:text-5xl mb-2">{catalog.label}</h1>
        <p className="gc-section-sub mb-2">
          {disputeCase.client.firstName} {disputeCase.client.lastName} · {disputeCase.client.grantsClientId} ·{" "}
          {statusLabel(disputeCase.status as DisputeCaseStatus)}
        </p>
        <p className="mb-8">
          <Link href={catalog.href} className="text-sm text-[var(--gc-ice)]">
            All {catalog.label} cases
          </Link>
          {" · "}
          <Link href={`/clients/${disputeCase.client.grantsClientId}`} className="text-sm text-[var(--gc-ice)]">
            Client 360
          </Link>
        </p>
        <CaseWorkspace disputeCase={disputeCase} canManage={hasPermission(user.role, "MANAGE_CREDIT")} />
      </div>
    );
  } catch {
    notFound();
  }
}
