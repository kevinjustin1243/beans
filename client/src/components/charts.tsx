// ─── DonutChart ───────────────────────────────────────────────────────────────

export interface Slice {
  label: string;
  value: number;
  color: string;
}

const PALETTE = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f43f5e", // rose
  "#84cc16", // lime
  "#3b82f6", // blue
  "#a855f7", // purple
];

export function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export function DonutChart({
  slices,
  size = 220,
  thickness = 28,
  centerLabel,
  centerValue,
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = slices.reduce((s, x) => s + Math.max(x.value, 0), 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;

  if (total <= 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={thickness} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="fill-slate-400 text-xs">
          No data
        </text>
      </svg>
    );
  }

  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
      {slices.map((s, i) => {
        const frac = Math.max(s.value, 0) / total;
        const len = c * frac;
        const dasharray = `${len} ${c - len}`;
        const dashoffset = -offset;
        offset += len;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={dasharray}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
      })}
      {centerValue && (
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-slate-900 text-xl font-semibold">
          {centerValue}
        </text>
      )}
      {centerLabel && (
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-400 text-xs uppercase tracking-wider">
          {centerLabel}
        </text>
      )}
    </svg>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

export function Sparkline({
  values,
  width = 80,
  height = 24,
  positive,
}: {
  values: number[];
  width?: number;
  height?: number;
  positive?: boolean;
}) {
  if (values.length < 2) {
    return <svg width={width} height={height} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);

  const points = values
    .map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`)
    .join(" ");

  const color = positive === undefined
    ? values[values.length - 1] >= values[0] ? "#10b981" : "#ef4444"
    : positive ? "#10b981" : "#ef4444";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── LineChart (large) ────────────────────────────────────────────────────────

export interface LinePoint {
  date: string;
  value: number;
}

export function LineChart({
  data,
  height = 240,
  color = "#6366f1",
}: {
  data: LinePoint[];
  height?: number;
  color?: string;
}) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-slate-400 text-sm" style={{ height }}>
        Not enough data points
      </div>
    );
  }

  const padX = 40;
  const padY = 20;
  const W = 640;
  const H = height;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = innerW / (data.length - 1);

  const pointsXY = data.map((d, i) => ({
    x: padX + i * stepX,
    y: padY + innerH - ((d.value - min) / range) * innerH,
    d,
  }));

  const linePath = pointsXY.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${pointsXY[pointsXY.length - 1].x},${padY + innerH} L${pointsXY[0].x},${padY + innerH} Z`;

  // Y-axis labels (3 levels)
  const yTicks = [
    { value: max, y: padY },
    { value: min + range / 2, y: padY + innerH / 2 },
    { value: min, y: padY + innerH },
  ];

  // X-axis labels (first, middle, last)
  const xTicks = [
    { date: data[0].date, x: padX },
    { date: data[Math.floor(data.length / 2)].date, x: padX + innerW / 2 },
    { date: data[data.length - 1].date, x: padX + innerW },
  ];

  function fmtY(n: number): string {
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    return `$${n.toFixed(0)}`;
  }

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <line
          key={i}
          x1={padX}
          x2={padX + innerW}
          y1={t.y}
          y2={t.y}
          stroke="#e2e8f0"
          strokeDasharray="2,3"
        />
      ))}

      {/* Y-axis labels */}
      {yTicks.map((t, i) => (
        <text key={i} x={padX - 6} y={t.y + 3} textAnchor="end" className="fill-slate-400 text-[10px]">
          {fmtY(t.value)}
        </text>
      ))}

      {/* X-axis labels */}
      {xTicks.map((t, i) => (
        <text
          key={i}
          x={t.x}
          y={H - 4}
          textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
          className="fill-slate-400 text-[10px]"
        >
          {t.date}
        </text>
      ))}

      {/* Area + line */}
      <path d={areaPath} fill="url(#areaGrad)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
