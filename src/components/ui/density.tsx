import Link from "next/link";
import { Sparkline } from "@/components/ui/charts";

export function Panel({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`gc-panel p-4 md:p-5 ${className}`}>
      {(title || eyebrow || action) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {eyebrow && <p className="gc-eyebrow mb-1">{eyebrow}</p>}
            {title && <h2 className="text-lg md:text-xl leading-tight">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function MetricTile({
  label,
  value,
  hint,
  href,
  trend,
  spark,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  trend?: string;
  spark?: number[];
  tone?: "default" | "ok" | "warn" | "danger" | "ice";
}) {
  const trendClass =
    tone === "ok"
      ? "text-[var(--gc-success)]"
      : tone === "warn"
        ? "text-[var(--gc-warning)]"
        : tone === "danger"
          ? "text-[var(--gc-danger)]"
          : tone === "ice"
            ? "text-[var(--gc-ice)]"
            : "text-[var(--gc-muted)]";

  const body = (
    <div className="gc-metric-tile h-full">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="gc-metric-label">{label}</p>
        {spark && spark.length > 1 && <Sparkline values={spark} />}
      </div>
      <p className="display text-2xl md:text-[1.85rem] leading-none tracking-tight">{value}</p>
      <div className="mt-2 flex items-center justify-between gap-2 min-h-[1rem]">
        {trend ? <p className={`text-[0.7rem] ${trendClass}`}>{trend}</p> : <span />}
        {hint ? <p className="text-[0.65rem] text-[var(--gc-muted)] truncate">{hint}</p> : null}
      </div>
    </div>
  );

  return href ? (
    <Link
      href={href}
      className="block h-full hover:opacity-95 transition-opacity"
      data-metric-label={label}
      data-metric-href={href}
    >
      {body}
    </Link>
  ) : (
    body
  );
}

export function StatRow({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string | number;
  href?: string;
  tone?: "default" | "warn" | "danger" | "ok";
}) {
  const toneClass =
    tone === "warn"
      ? "text-[var(--gc-warning)]"
      : tone === "danger"
        ? "text-[var(--gc-danger)]"
        : tone === "ok"
          ? "text-[var(--gc-success)]"
          : "";
  const inner = (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--gc-border)] last:border-0">
      <span className="text-sm text-[var(--gc-text-secondary)]">{label}</span>
      <span className={`display text-lg ${toneClass}`}>{value}</span>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function ProgressSteps({
  steps,
}: {
  steps: { label: string; status: "COMPLETE" | "MISSING" | "CURRENT" | "WAIVED" }[];
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const done = s.status === "COMPLETE" || s.status === "WAIVED";
        const current = s.status === "CURRENT";
        return (
          <div key={`${s.label}-${i}`} className="min-w-[4.5rem] flex-1">
            <div
              className={`h-1.5 rounded-full mb-2 ${
                done ? "bg-[var(--gc-ice)]" : current ? "bg-[var(--gc-gold)]" : "bg-white/10"
              }`}
            />
            <p className="text-[0.58rem] tracking-[0.08em] uppercase text-[var(--gc-muted)] leading-tight">
              {s.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
