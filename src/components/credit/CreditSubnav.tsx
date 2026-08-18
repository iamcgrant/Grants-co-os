import Link from "next/link";

const ITEMS = [
  { href: "/credit", label: "Overview" },
  { href: "/credit/disputefox", label: "DisputeFox" },
  { href: "/credit/experian", label: "Experian" },
  { href: "/credit/smartcredit", label: "SmartCredit" },
  { href: "/credit/credit-karma", label: "Credit Karma" },
  { href: "/credit/escalations", label: "Escalations · CFPB" },
  { href: "/credit-pulse", label: "Friday Pulse" },
] as const;

export function CreditSubnav({ current }: { current: string }) {
  return (
    <nav className="flex flex-wrap gap-2 mb-8">
      {ITEMS.map((item) => {
        const active = current === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full border px-3 py-1.5 text-xs tracking-[0.12em] uppercase ${
              active
                ? "border-[var(--gc-gold)] text-[var(--gc-gold)]"
                : "border-[var(--gc-border)] text-[var(--gc-muted)] hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
