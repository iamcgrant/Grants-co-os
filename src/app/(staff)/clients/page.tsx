import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { CreateClientForm } from "@/components/clients/CreateClientForm";

export default async function ClientsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_CLIENT")) {
    return <p>Access denied.</p>;
  }

  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="gc-fade-up mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <p className="text-[0.7rem] tracking-[0.3em] uppercase text-[var(--gc-champagne-dim)] mb-2">
            Master Identity
          </p>
          <h1 className="text-4xl md:text-5xl mb-2">Clients</h1>
          <p className="text-sm text-[var(--gc-muted)]">
            Every person has one permanent Grants Client ID.
          </p>
        </div>
      </div>

      {hasPermission(user.role, "CREATE_CLIENT") && (
        <div className="mb-12 gc-fade-up-delay">
          <CreateClientForm />
        </div>
      )}

      <div className="divide-y divide-[var(--gc-border)] gc-fade-up-delay-2">
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/clients/${c.grantsClientId}`}
            className="py-5 flex items-center justify-between gap-4 hover:opacity-80 transition-opacity block"
          >
            <div>
              <p className="font-medium text-lg">
                {c.firstName} {c.lastName}
              </p>
              <p className="text-xs text-[var(--gc-muted)]">
                {c.grantsClientId} · {c.email}
              </p>
            </div>
            <span className="text-[0.65rem] tracking-[0.16em] uppercase text-[var(--gc-champagne-dim)]">
              View
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
