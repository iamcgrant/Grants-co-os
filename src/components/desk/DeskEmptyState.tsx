import { OfficialLoginLink } from "@/components/desk/OfficialLoginLink";

export function DeskEmptyState({
  title = "ACTION REQUIRED",
  detail,
  nextAction,
  loginUrl,
}: {
  title?: string;
  detail: string;
  nextAction: string;
  loginUrl?: string | null;
}) {
  return (
    <div className="gc-card mb-10 max-w-3xl border border-[var(--gc-gold)]/40">
      <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-gold)] mb-2">{title}</p>
      <p className="text-lg display">Honest empty desk</p>
      <p className="text-sm text-[var(--gc-muted)] mt-2">{detail}</p>
      <p className="text-sm mt-3">{nextAction}</p>
      {loginUrl ? (
        <div className="mt-4">
          <OfficialLoginLink href={loginUrl} />
        </div>
      ) : null}
    </div>
  );
}
