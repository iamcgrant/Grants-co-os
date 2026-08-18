import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { getDesktopNav, getStaffNav, roleDisplayName } from "@/lib/nav/role-nav";
import type { AuthUserView } from "@/lib/auth/types";
import type { StaffRole, NavItem } from "@/lib/nav/role-nav";

function withSectionLabels(nav: NavItem[]) {
  let lastGroup = "";
  return nav.map((item) => {
    const showSection = Boolean(item.group && item.group !== "primary" && item.group !== lastGroup);
    if (item.group) lastGroup = item.group;
    return { item, showSection };
  });
}

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
  const desktopNav = withSectionLabels(getDesktopNav(user.role as StaffRole));
  const cols = Math.min(Math.max(mobileNav.length, 4), 7);
  const pathBase = pathname.split("?")[0];
  const isOwner = user.role === "OWNER" || user.role === "ADMIN";

  function isActive(href: string) {
    const base = href.split("?")[0];
    if (href.includes("view=jona") && pathname.includes("view=jona")) return true;
    if (base === "/team-chat" && (pathBase === "/team-chat" || pathname.includes("tab=team"))) return true;
    if (base === "/home") return pathBase === "/home";
    return pathBase === base || pathBase.startsWith(`${base}/`);
  }

  return (
    <div className="min-h-dvh gc-app-shell">
      {process.env.NODE_ENV !== "production" || process.env.GC_ENV === "development" ? (
        <div className="gc-dev-banner">Development environment · sample data isolated from production</div>
      ) : null}

      <aside className="gc-sidebar">
        <div className="gc-sidebar-brand">
          <BrandLogo href="/home" size="sm" />
        </div>
        <nav className="gc-sidebar-nav">
          {desktopNav.map(({ item, showSection }) => (
            <div key={`${item.href}-${item.label}`}>
              {showSection ? (
                <p className="gc-sidebar-section">
                  {item.group === "ops" ? "Operations" : item.group === "finance" ? "Finance" : "System"}
                </p>
              ) : null}
              <Link
                href={item.href}
                className={`gc-sidebar-link ${isActive(item.href) ? "is-active" : ""}`}
              >
                <span className="gc-sidebar-dot" aria-hidden />
                {item.label}
              </Link>
            </div>
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
            <div className="md:hidden">
              <BrandLogo href="/home" size="sm" />
            </div>
            <form action="/search" className="gc-search-wrap" method="get">
              <input
                name="q"
                className="gc-search"
                placeholder="Search clients, invoices, payments, IDs…"
                aria-label="Global search"
              />
            </form>
            <div className="gc-topbar-actions">
              {isOwner && (
                <Link href="/credit" className="gc-btn gc-btn-outline text-xs py-2 px-3">
                  Credit
                </Link>
              )}
              <Link href="/clients" className="gc-btn gc-btn-gold text-xs py-2 px-3">
                + New Client
              </Link>
              <Link href="/inbox" className="gc-icon-btn" title="Inbox">
                Inbox
              </Link>
              <Link href="/more#systems" className="gc-icon-btn" title="Systems">
                Systems
              </Link>
            </div>
            <div className="hidden sm:block text-right min-w-[7.5rem]">
              <p className="text-sm font-medium leading-tight">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[0.58rem] tracking-[0.12em] uppercase text-[var(--gc-ice)]">
                {roleDisplayName(user.role as StaffRole)}
              </p>
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
