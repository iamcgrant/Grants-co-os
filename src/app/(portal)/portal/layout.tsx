import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CLIENT") redirect("/dashboard");

  return (
    <div className="min-h-dvh pb-24">
      <header className="px-5 py-5 border-b border-[var(--gc-border)]">
        <p className="text-[0.7rem] tracking-[0.35em] uppercase text-[var(--gc-gold)]">
          Grants &amp; Co
        </p>
        <p className="text-sm text-[var(--gc-muted)] mt-1">
          {user.firstName} {user.lastName}
        </p>
      </header>
      <div className="px-5 py-8 max-w-lg mx-auto">{children}</div>
      <nav className="gc-nav-mobile" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          ["/portal", "Home"],
          ["/portal/credit", "Credit"],
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
