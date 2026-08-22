import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { DialerWorkspace } from "@/components/comms/DialerWorkspace";

export default async function DialerPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; contactId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { to, contactId } = await searchParams;

  return (
    <div className="gc-fade-up space-y-6">
      <div>
        <p className="gc-eyebrow mb-2">Client voice</p>
        <h1 className="text-3xl md:text-4xl mb-2">Dialer</h1>
        <p className="gc-section-sub">
          Place and receive calls on existing GHL / LeadConnector numbers. The OS owns the desk —
          GHL stays the phone backend.
        </p>
      </div>
      <DialerWorkspace initialTo={to} contactId={contactId} />
    </div>
  );
}
