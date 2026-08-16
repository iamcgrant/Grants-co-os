import { Sparkline } from "@/components/ui/charts";
import type { ScoreGroup } from "@/lib/credit/score-intelligence";

export function ScoreIntelligencePanel({ groups }: { groups: ScoreGroup[] }) {
  if (!groups.length) {
    return <p className="text-sm text-[var(--gc-muted)]">No score history yet.</p>;
  }

  return (
    <div className="gc-dash-grid gc-dash-grid-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      {groups.map((g) => {
        const spark = g.history.map((h) => h.score);
        const up = (g.periodChange ?? 0) >= 0;
        return (
          <div key={g.key} className="gc-score-card">
            <div className="gc-score-card-top">
              <div>
                <p className="text-[0.62rem] tracking-[0.16em] uppercase text-[var(--gc-ice)] mb-1">
                  {g.bureau}
                </p>
                <p className="text-[0.68rem] text-[var(--gc-muted)]">
                  {g.source} · {g.scoringModel}
                </p>
              </div>
              {spark.length > 1 && <Sparkline values={spark} width={72} height={28} />}
            </div>

            <div className="flex items-end justify-between gap-3 mt-2 mb-1">
              <p className="display text-4xl md:text-5xl leading-none">{g.current?.score ?? "—"}</p>
              <p className={`text-sm font-medium mb-1 ${up ? "text-[var(--gc-success)]" : "text-[var(--gc-danger)]"}`}>
                {g.periodChange != null
                  ? `${g.periodChange >= 0 ? "↑" : "↓"} ${Math.abs(g.periodChange)} pts`
                  : "—"}
              </p>
            </div>

            <div className="gc-score-meta">
              <div>
                <p>Previous</p>
                <p className="display text-xl">{g.previous?.score ?? "—"}</p>
              </div>
              <div>
                <p>Baseline</p>
                <p className="display text-xl">{g.baseline?.score ?? "—"}</p>
              </div>
            </div>
            {g.overallChange != null && (
              <p className={`text-xs mt-2 ${g.overallChange >= 0 ? "text-[var(--gc-success)]" : "text-[var(--gc-danger)]"}`}>
                {g.overallChange >= 0 ? "+" : ""}
                {g.overallChange} overall from baseline
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
