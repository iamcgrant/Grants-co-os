export type ScorePoint = {
  bureau: string;
  score: number;
  scoringModel: string;
  source: string;
  capturedAt: Date;
};

export type ScoreGroup = {
  key: string;
  bureau: string;
  scoringModel: string;
  source: string;
  baseline?: ScorePoint;
  previous?: ScorePoint;
  current?: ScorePoint;
  periodChange: number | null;
  overallChange: number | null;
  history: ScorePoint[];
};

/** Preserve model/source separation — never treat different models as equivalent. */
export function buildScoreIntelligence(
  scores: Array<{
    bureau: string;
    score: number;
    scoringModel: string;
    source: string;
    capturedAt: Date;
  }>,
): ScoreGroup[] {
  const map = new Map<string, ScorePoint[]>();
  for (const s of scores) {
    const key = `${s.bureau}|${s.scoringModel}|${s.source}`;
    const list = map.get(key) || [];
    list.push({
      bureau: s.bureau,
      score: s.score,
      scoringModel: s.scoringModel,
      source: s.source,
      capturedAt: s.capturedAt,
    });
    map.set(key, list);
  }

  const groups: ScoreGroup[] = [];
  for (const [key, history] of map) {
    const sorted = [...history].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
    const baseline = sorted[0];
    const current = sorted[sorted.length - 1];
    const previous = sorted.length > 1 ? sorted[sorted.length - 2] : undefined;
    groups.push({
      key,
      bureau: baseline.bureau,
      scoringModel: baseline.scoringModel,
      source: baseline.source,
      baseline,
      previous,
      current,
      periodChange: previous ? current.score - previous.score : null,
      overallChange: current.score - baseline.score,
      history: sorted,
    });
  }

  return groups.sort((a, b) => a.bureau.localeCompare(b.bureau) || a.source.localeCompare(b.source));
}
