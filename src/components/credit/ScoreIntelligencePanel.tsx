import type { ScoreGroup } from "@/lib/credit/score-intelligence";

export function ScoreIntelligencePanel({ groups }: { groups: ScoreGroup[] }) {
  if (!groups.length) {
    return <p className="text-sm text-[var(--gc-muted)]">No score history yet.</p>;
  }

  return (
    <div className="gc-grid-dense gc-grid-dense-3">
      {groups.map((g) => {
        const max = Math.max(...g.history.map((h) => h.score), 1);
        const min = Math.min(...g.history.map((h) => h.score), 0);
        const span = Math.max(max - min, 20);
        return (
          <div key={g.key} className="gc-card">
            <p className="text-[0.62rem] tracking-[0.16em] uppercase text-[var(--gc-ice)] mb-1">
              {g.bureau}
            </p>
            <p className="text-xs text-[var(--gc-muted)] mb-3">
              {g.source} · {g.scoringModel}
            </p>
            <p className="display text-4xl mb-2">{g.current?.score ?? "—"}</p>
            <p className="text-sm text-[var(--gc-muted)] mb-3">
              {g.baseline?.score ?? "—"} → {g.previous?.score ?? "—"} → {g.current?.score ?? "—"}
            </p>
            <div className="flex gap-3 text-xs mb-4">
              <span className={g.periodChange != null && g.periodChange >= 0 ? "text-[var(--gc-success)]" : "text-[var(--gc-danger)]"}>
                {g.periodChange != null ? `${g.periodChange >= 0 ? "+" : ""}${g.periodChange} period` : "—"}
              </span>
              <span className={g.overallChange != null && g.overallChange >= 0 ? "text-[var(--gc-success)]" : "text-[var(--gc-danger)]"}>
                {g.overallChange != null ? `${g.overallChange >= 0 ? "+" : ""}${g.overallChange} overall` : "—"}
              </span>
            </div>
            <div className="flex items-end gap-1 h-16">
              {g.history.map((h, idx) => {
                const height = 18 + ((h.score - min) / span) * 46;
                return (
                  <div
                    key={`${h.capturedAt.toISOString()}-${idx}`}
                    title={`${h.score} · ${h.capturedAt.toLocaleDateString()}`}
                    className="flex-1 rounded-t bg-[var(--gc-ice)]/70"
                    style={{ height }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
