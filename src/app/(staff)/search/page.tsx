import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { universalSearch } from "@/lib/search/universal";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "VIEW_CLIENT")) redirect("/home");

  const { q = "" } = await searchParams;
  const hits = q.trim().length >= 2 ? await universalSearch(q) : [];

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">Universal search</p>
      <h1 className="text-4xl mb-6">Search</h1>
      <form className="mb-8" action="/search" method="get">
        <input
          name="q"
          defaultValue={q}
          className="gc-input"
          placeholder="Client, phone, email, invoice, payment, GHL ID, DisputeFox ID…"
          autoFocus
        />
      </form>

      {q.trim().length > 0 && q.trim().length < 2 ? (
        <p className="text-[var(--gc-muted)]">Enter at least 2 characters.</p>
      ) : null}

      {q.trim().length >= 2 && hits.length === 0 ? (
        <p className="text-[var(--gc-muted)]">No matches · DATA UNAVAILABLE for unverified sources.</p>
      ) : null}

      <div className="space-y-3">
        {hits.map((h) => (
          <Link
            key={`${h.type}-${h.id}`}
            href={h.href}
            className="gc-card block hover:bg-white/[0.06] transition-colors"
          >
            <p className="text-[0.65rem] tracking-[0.16em] uppercase text-[var(--gc-gold)] mb-1">
              {h.type}
            </p>
            <p className="text-lg">{h.title}</p>
            <p className="text-sm text-[var(--gc-muted)] mt-1">{h.subtitle}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
