import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

const NAV = [
  { href: "/dashboard", label: "Finance" },
  { href: "/clients", label: "Clients" },
  { href: "/operations", label: "Ops" },
  { href: "/credit-pulse", label: "Credit" },
  { href: "/intelligence", label: "Intel" },
];

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "CLIENT") redirect("/portal");

  return (
    <div className="min-h-dvh pb-24 md:pb-8">
      <header className="sticky top-0 z-40 border-b border-[var(--gc-border)] bg-[rgba(22,22,26,0.88)] backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between gap-4">
          <Link href="/dashboard" className="display text-2xl tracking-tight">
            Grants <span className="text-[var(--gc-gold)]">&amp;</span> Co
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-[0.75rem] tracking-[0.14em] uppercase text-[var(--gc-muted)]">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="text-right">
            <p className="text-sm font-medium">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-[0.65rem] tracking-[0.16em] uppercase text-[var(--gc-muted)]">
              {user.role.replace("_", " ")}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>

      <nav className="gc-nav-mobile">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-center text-[0.65rem] tracking-[0.08em] uppercase text-[var(--gc-muted)] py-1"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
