import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { getStaffNav, roleDisplayName } from "@/lib/nav/role-nav";
import type { AuthUserView } from "@/lib/auth/types";
import type { StaffRole } from "@/lib/nav/role-nav";

export function StaffShell({
  user,
  children,
  pathname = "/home",
}: {
  user: AuthUserView;
  children: React.ReactNode;
  pathname?: string;
}) {
  const nav = getStaffNav(user.role as StaffRole);
  const cols = Math.min(Math.max(nav.length, 4), 7);

  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      {process.env.NODE_ENV !== "production" || process.env.GC_ENV === "development" ? (
        <div className="gc-dev-banner">Development environment · sample data isolated from production</div>
      ) : null}

      <header className="sticky top-0 z-40 border-b border-[var(--gc-border)] bg-[rgba(22,22,26,0.92)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-3.5 flex items-center justify-between gap-4">
          <BrandLogo href="/home" size="md" />
          <nav className="hidden lg:flex items-center gap-5 text-[0.72rem] tracking-[0.14em] uppercase text-[var(--gc-muted)]">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? "text-white" : "hover:text-white transition-colors"}
                  data-active={active}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="text-right min-w-[7rem]">
            <p className="text-sm font-medium leading-tight">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-ice)]">
              {roleDisplayName(user.role as StaffRole)}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 md:px-6 py-7 md:py-9">{children}</div>

      <nav className="gc-nav-mobile" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} data-active={active}>
              {item.short || item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
