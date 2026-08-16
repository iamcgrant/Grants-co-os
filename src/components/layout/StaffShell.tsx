import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { getDesktopNav, getStaffNav, roleDisplayName } from "@/lib/nav/role-nav";
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
  const mobileNav = getStaffNav(user.role as StaffRole);
  const desktopNav = getDesktopNav(user.role as StaffRole);
  const cols = Math.min(Math.max(mobileNav.length, 4), 7);
  const pathBase = pathname.split("?")[0];

  function isActive(href: string) {
    const base = href.split("?")[0];
    return pathBase === base || pathBase.startsWith(`${base}/`);
  }

  return (
    <div className="min-h-dvh gc-app-shell">
      {process.env.NODE_ENV !== "production" || process.env.GC_ENV === "development" ? (
        <div className="gc-dev-banner">Development environment · sample data isolated from production</div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="gc-sidebar">
        <div className="gc-sidebar-brand">
          <BrandLogo href="/home" size="sm" />
        </div>
        <nav className="gc-sidebar-nav">
          {desktopNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`gc-sidebar-link ${isActive(item.href) ? "is-active" : ""}`}
            >
              <span className="gc-sidebar-dot" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="gc-sidebar-foot">
          <p className="text-sm font-medium truncate">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-[0.6rem] tracking-[0.14em] uppercase text-[var(--gc-ice)]">
            {roleDisplayName(user.role as StaffRole)}
          </p>
        </div>
      </aside>

      <div className="gc-main">
        <header className="gc-topbar">
          <div className="gc-topbar-inner">
            <div className="lg:hidden">
              <BrandLogo href="/home" size="sm" />
            </div>
            <form action="/clients" className="gc-search-wrap" method="get">
              <input
                name="q"
                className="gc-search"
                placeholder="Search clients, tasks, invoices…"
                aria-label="Global search"
              />
            </form>
            <div className="flex items-center gap-3">
              <Link href="/inbox" className="gc-icon-btn" title="Inbox">
                Inbox
              </Link>
              <Link href="/more#systems" className="gc-icon-btn" title="Systems">
                Systems
              </Link>
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium leading-tight">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-[0.58rem] tracking-[0.12em] uppercase text-[var(--gc-ice)]">
                  {roleDisplayName(user.role as StaffRole)}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="gc-content">{children}</div>
      </div>

      <nav className="gc-nav-mobile" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {mobileNav.map((item) => (
          <Link key={item.href} href={item.href} data-active={isActive(item.href)}>
            {item.short || item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
