/** Tiny SVG sparkline for dense dashboards — no chart library dependency */
export function Sparkline({
  values,
  width = 88,
  height = 28,
  stroke = "var(--gc-ice)",
  fill = "rgba(178, 212, 255, 0.12)",
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
}) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * width;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    return `${x},${y}`;
  });
  const line = pts.join(" ");
  const area = `0,${height} ${line} ${width},${height}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <polygon points={area} fill={fill} />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function DonutChart({
  segments,
  size = 120,
  thickness = 14,
  centerLabel,
  centerSub,
}: {
  segments: { value: number; color: string; label?: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
        {segments.map((seg, i) => {
          const len = (seg.value / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      {(centerLabel || centerSub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          {centerLabel && <p className="display text-xl leading-none">{centerLabel}</p>}
          {centerSub && <p className="text-[0.6rem] tracking-[0.12em] uppercase text-[var(--gc-muted)] mt-1">{centerSub}</p>}
        </div>
      )}
    </div>
  );
}

export function LineChart({
  series,
  width = 520,
  height = 160,
  labels = [],
}: {
  series: { name: string; color: string; values: number[] }[];
  width?: number;
  height?: number;
  labels?: string[];
}) {
  const all = series.flatMap((s) => s.values);
  if (!all.length) return null;
  const min = Math.min(...all) * 0.96;
  const max = Math.max(...all) * 1.02;
  const span = Math.max(max - min, 1);
  const pad = 8;

  function pathFor(values: number[]) {
    return values
      .map((v, i) => {
        const x = pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2);
        const y = height - pad - ((v - min) / span) * (height - pad * 2);
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  }

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={pad}
            x2={width - pad}
            y1={pad + t * (height - pad * 2)}
            y2={pad + t * (height - pad * 2)}
            stroke="rgba(255,255,255,0.06)"
          />
        ))}
        {series.map((s) => (
          <path key={s.name} d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth="2" />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3">
        {series.map((s) => (
          <span key={s.name} className="text-[0.65rem] text-[var(--gc-muted)] inline-flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      {labels.length > 0 && (
        <div className="mt-1 flex justify-between text-[0.6rem] text-[var(--gc-muted)]">
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}
