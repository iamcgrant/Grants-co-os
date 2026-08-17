import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { BrandLogo } from "@/components/brand/BrandLogo";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CLIENT") redirect("/home");

  return (
    <div className="min-h-dvh pb-24">
      {process.env.NODE_ENV !== "production" || process.env.GC_ENV === "development" ? (
        <div className="gc-dev-banner">Client portal · development data</div>
      ) : null}
      <header className="px-5 py-5 border-b border-[var(--gc-border)] flex items-center justify-between gap-4">
        <BrandLogo href="/portal" size="sm" />
        <p className="text-sm text-[var(--gc-muted)]">
          {user.firstName} {user.lastName}
        </p>
      </header>
      <div className="px-5 py-8 max-w-lg mx-auto">{children}</div>
      <nav className="gc-nav-mobile" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {[
          ["/portal", "Home"],
          ["/portal/credit", "Credit"],
          ["/portal/pulse", "Pulse"],
          ["/portal/payments", "Pay"],
          ["/portal/documents", "Docs"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="text-center text-[0.65rem] tracking-[0.08em] uppercase text-[var(--gc-muted)] py-1"
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
