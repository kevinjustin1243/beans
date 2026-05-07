import { useEffect, useRef, useState } from "react";
import { fmtUSD } from "../lib/format";

// ─── Sparkline ────────────────────────────────────────────────────────────────

export function Sparkline({
  data,
  color = "#7dd87a",
  height = 32,
  width = 120,
  fill = true,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  fill?: boolean;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return [x, y] as [number, number];
  });
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;
  const gradId = `spark-${color.replace("#", "")}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      {fill && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={area} fill={`url(#${gradId})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── AreaChart ─────────────────────────────────────────────────────────────────

interface SeriesPoint { date: string; value: number }

export function AreaChart({
  series,
  color = "#7dd87a",
  height = 240,
  formatValue = (v: number) => fmtUSD(v, { compact: true }),
  formatDate = (d: string) => d,
}: {
  series: SeriesPoint[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
  formatDate?: (d: string) => string;
}) {
  const [hover, setHover] = useState<(SeriesPoint & { x: number; y: number }) | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const padL = 8, padR = 8, padT = 16, padB = 28;
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;
  const values = series.map((s) => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const yPad = range * 0.1;
  const yMin = min - yPad, yMax = max + yPad, yRange = yMax - yMin;

  const pts = series.map((s, i) => ({
    x: padL + (i / (series.length - 1)) * innerW,
    y: padT + innerH - ((s.value - yMin) / yRange) * innerH,
    ...s,
  }));
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${path} L${pts[pts.length - 1].x},${padT + innerH} L${pts[0].x},${padT + innerH} Z`;

  function onMove(e: React.MouseEvent) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const i = Math.max(0, Math.min(series.length - 1, Math.round(((x - padL) / innerW) * (series.length - 1))));
    setHover(pts[i]);
  }

  const gridY = [0, 0.25, 0.5, 0.75, 1].map((t) => padT + innerH * t);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      <svg
        width={w}
        height={height}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        className="block"
      >
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridY.map((y, i) => (
          <line key={i} x1={padL} x2={w - padR} y1={y} y2={y} stroke="rgba(148,163,184,0.08)" strokeDasharray="2 4" />
        ))}
        <path d={area} fill="url(#area-fill)" />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {hover && (
          <>
            <line x1={hover.x} x2={hover.x} y1={padT} y2={padT + innerH} stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
            <circle cx={hover.x} cy={hover.y} r="5" fill={color} />
            <circle cx={hover.x} cy={hover.y} r="9" fill={color} fillOpacity="0.18" />
          </>
        )}
      </svg>
      {hover && (
        <div
          className="absolute pointer-events-none px-3 py-2 rounded-lg bg-neutral-900/95 ring-1 ring-white/10 backdrop-blur text-xs whitespace-nowrap"
          style={{
            left: Math.min(Math.max(hover.x - 60, 4), w - 130),
            top: Math.max(hover.y - 56, 4),
          }}
        >
          <div className="text-neutral-400 text-[10px] uppercase tracking-wider mb-0.5">{formatDate(hover.date)}</div>
          <div className="text-white font-semibold tabular-nums">{formatValue(hover.value)}</div>
        </div>
      )}
    </div>
  );
}

// ─── Donut ────────────────────────────────────────────────────────────────────

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

export function Donut({
  slices,
  size = 180,
  thickness = 22,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - thickness / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth={thickness} />
      {slices.map((s, i) => {
        const len = (s.value / total) * c;
        const dash = `${len} ${c - len}`;
        const offset = -acc;
        acc += len;
        return (
          <circle
            key={i}
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={dash}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        );
      })}
      {centerValue && (
        <g>
          <text x="50%" y="48%" textAnchor="middle" fill="rgba(163,163,163,1)" fontSize="10" letterSpacing="1.5">
            {centerLabel}
          </text>
          <text x="50%" y="58%" textAnchor="middle" fill="white" fontSize="18" fontWeight="600">
            {centerValue}
          </text>
        </g>
      )}
    </svg>
  );
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export function Progress({
  value,
  max,
  color = "bg-emerald-400",
  height = "h-1.5",
}: {
  value: number;
  max: number;
  color?: string;
  height?: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className={`w-full ${height} bg-white/5 rounded-full overflow-hidden`}>
      <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}
