import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function PortalDocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const client = await prisma.client.findFirst({
    where: { userId: user.id },
    include: { documents: true },
  });
  if (!client) return <p>No profile</p>;

  return (
    <div className="gc-fade-up space-y-6">
      <div>
        <h1 className="text-4xl mb-2">Documents</h1>
        <p className="text-sm text-[var(--gc-muted)]">
          Secure upload and access for approved document types.
        </p>
      </div>
      {client.documents.length === 0 ? (
        <p className="text-sm text-[var(--gc-muted)]">
          No documents yet. Upload will connect to secure object storage when configured.
        </p>
      ) : (
        client.documents.map((d) => (
          <div key={d.id} className="py-3 border-b border-[var(--gc-border)]">
            <p className="font-medium">{d.name}</p>
            <p className="text-xs text-[var(--gc-muted)]">{d.category || d.mimeType}</p>
          </div>
        ))
      )}
    </div>
  );
}
