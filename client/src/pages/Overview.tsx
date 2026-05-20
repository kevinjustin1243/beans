import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { DonutChart, LineChart, colorFor } from "../components/charts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Summary {
  net_worth: number;
  monthly_income: number;
  monthly_spending: number;
  savings_rate: number;
  currency?: string;
}

interface BreakdownRow {
  category: string;
  total: number;
  currency: string;
}

interface TrendPoint {
  month: string;
  value: number;
  date: string;
}

interface BudgetRow {
  category: string;
  account: string;
  budget: number;
  spent: number;
}

interface Bill {
  name: string;
  amount: number;
  currency: string;
  category: string;
  due_date: string;
  days_until: number;
}

interface HealthFactor {
  name: string;
  score: number;
  max: number;
  color: string;
}

interface Health {
  factors: HealthFactor[];
  overall: number;
}

interface Insight {
  type: "opportunity" | "warning" | "positive";
  title: string;
  description: string;
}

interface CategoryForecast {
  category: string;
  current: number;
  predicted: number;
}

interface NetWorthProjPoint {
  month: string;
  actual: number | null;
  low: number;
  high: number;
}

interface SectorRow {
  sector: string;
  value: number;
  percent: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

async function fetchJSON<T>(path: string): Promise<T | null> {
  const res = await apiFetch(path);
  if (!res.ok) return null;
  return (await res.json()) as T;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Overview() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [budget, setBudget] = useState<BudgetRow[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [catForecast, setCatForecast] = useState<CategoryForecast[]>([]);
  const [nwProj, setNwProj] = useState<NetWorthProjPoint[]>([]);
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [s, b, t, bg, bl, h, i, cf, nw, sec] = await Promise.all([
        fetchJSON<Summary>("/api/dashboard/summary"),
        fetchJSON<{ breakdown: BreakdownRow[] }>("/api/dashboard/spending-breakdown"),
        fetchJSON<{ trend: TrendPoint[] }>("/api/dashboard/net-worth-trend"),
        fetchJSON<{ categories: BudgetRow[] }>("/api/dashboard/budget"),
        fetchJSON<{ bills: Bill[] }>("/api/dashboard/upcoming-bills"),
        fetchJSON<Health>("/api/predictions/health-score"),
        fetchJSON<{ insights: Insight[] }>("/api/predictions/insights"),
        fetchJSON<{ forecast: CategoryForecast[] }>("/api/predictions/spending-categories"),
        fetchJSON<{ projection: NetWorthProjPoint[] }>("/api/predictions/net-worth"),
        fetchJSON<{ total: number; sectors: SectorRow[] }>("/api/investments/sector-allocation"),
      ]);
      if (cancelled) return;
      setSummary(s);
      setBreakdown(b?.breakdown ?? []);
      setTrend(t?.trend ?? []);
      setBudget(bg?.categories ?? []);
      setBills(bl?.bills ?? []);
      setHealth(h);
      setInsights(i?.insights ?? []);
      setCatForecast(cf?.forecast ?? []);
      setNwProj(nw?.projection ?? []);
      setSectors(sec?.sectors ?? []);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const currency = summary?.currency ?? "USD";

  const donutSlices = useMemo(
    () => breakdown.slice(0, 8).map((row, i) => ({ label: row.category, value: row.total, color: colorFor(i) })),
    [breakdown],
  );

  const sectorSlices = useMemo(
    () => sectors.map((row, i) => ({ label: row.sector, value: row.value, color: colorFor(i) })),
    [sectors],
  );

  const trendPoints = useMemo(() => trend.map((t) => ({ date: t.month, value: t.value })), [trend]);

  if (loading) {
    return <div className="p-6 text-slate-400">Loading…</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Stat label="Net worth" value={fmtMoney(summary?.net_worth ?? 0, currency)} accent="emerald" />
        <Stat label="Income (this mo)" value={fmtMoney(summary?.monthly_income ?? 0, currency)} accent="indigo" />
        <Stat label="Spending (this mo)" value={fmtMoney(summary?.monthly_spending ?? 0, currency)} accent="rose" />
        <Stat label="Savings rate" value={fmtPct(summary?.savings_rate ?? 0)} accent="amber" />
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <Card title="Insights">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((ins, idx) => (
              <InsightCard key={idx} insight={ins} />
            ))}
          </div>
        </Card>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Net worth — last 6 months">
          {trendPoints.length >= 2 ? (
            <LineChart data={trendPoints} height={220} />
          ) : (
            <Empty />
          )}
        </Card>
        <Card title="Spending this month">
          {donutSlices.length > 0 ? (
            <div className="flex items-center gap-6">
              <DonutChart
                slices={donutSlices}
                centerLabel="total"
                centerValue={fmtMoney(donutSlices.reduce((a, b) => a + b.value, 0), currency)}
              />
              <ul className="text-sm space-y-1.5 flex-1 min-w-0">
                {donutSlices.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                      <span className="truncate text-slate-700">{s.label}</span>
                    </span>
                    <span className="text-slate-500 tabular-nums">{fmtMoney(s.value, currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Empty />
          )}
        </Card>
      </div>

      {/* Health + projection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Financial health">
          {health ? <HealthPanel health={health} /> : <Empty />}
        </Card>
        <Card title="Net worth — projected 12 months">
          {nwProj.length >= 2 ? <ProjectionPanel rows={nwProj} currency={currency} /> : <Empty />}
        </Card>
      </div>

      {/* Sector allocation (only shown when there's something to allocate) */}
      {sectorSlices.length > 0 && (
        <Card title="Portfolio by sector">
          <div className="flex items-center gap-6">
            <DonutChart
              slices={sectorSlices}
              centerLabel="invested"
              centerValue={fmtMoney(sectorSlices.reduce((a, b) => a + b.value, 0), currency)}
            />
            <ul className="text-sm space-y-1.5 flex-1 min-w-0">
              {sectors.map((s, i) => (
                <li key={s.sector} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colorFor(i) }} />
                    <span className="truncate text-slate-700">{s.sector}</span>
                  </span>
                  <span className="text-slate-500 tabular-nums">
                    {fmtMoney(s.value, currency)} <span className="text-slate-400 text-xs">({s.percent.toFixed(0)}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {/* Forecast + budget + bills */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Spending forecast (next month)">
          {catForecast.length > 0 ? (
            <CategoryForecastTable rows={catForecast} currency={currency} />
          ) : (
            <Empty />
          )}
        </Card>
        <Card title="Budget progress">
          {budget.length > 0 ? <BudgetList rows={budget} currency={currency} /> : <Empty hint="Set targets on the Budget page" />}
        </Card>
        <Card title="Upcoming bills">
          {bills.length > 0 ? <BillsList rows={bills} currency={currency} /> : <Empty hint="No recurring charges detected yet" />}
        </Card>
      </div>
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: "emerald" | "indigo" | "rose" | "amber" }) {
  const accents: Record<string, string> = {
    emerald: "from-emerald-50 to-white border-emerald-100",
    indigo: "from-indigo-50 to-white border-indigo-100",
    rose: "from-rose-50 to-white border-rose-100",
    amber: "from-amber-50 to-white border-amber-100",
  };
  return (
    <div className={`bg-gradient-to-b ${accents[accent]} border rounded-xl p-4`}>
      <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-xl md:text-2xl font-semibold text-slate-900 mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function Empty({ hint }: { hint?: string } = {}) {
  return (
    <div className="text-sm text-slate-400 italic py-6 text-center">
      {hint ?? "No data yet"}
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const styles: Record<Insight["type"], { bar: string; tag: string; label: string }> = {
    opportunity: { bar: "bg-indigo-500", tag: "bg-indigo-50 text-indigo-700", label: "Opportunity" },
    warning: { bar: "bg-amber-500", tag: "bg-amber-50 text-amber-700", label: "Heads up" },
    positive: { bar: "bg-emerald-500", tag: "bg-emerald-50 text-emerald-700", label: "Good news" },
  };
  const s = styles[insight.type];
  return (
    <div className="flex gap-3 p-3 rounded-lg border border-slate-200">
      <div className={`w-1 rounded-full ${s.bar}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${s.tag}`}>
            {s.label}
          </span>
        </div>
        <div className="font-semibold text-slate-900 text-sm">{insight.title}</div>
        <div className="text-sm text-slate-600 mt-1">{insight.description}</div>
      </div>
    </div>
  );
}

function HealthPanel({ health }: { health: Health }) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-4xl font-semibold text-slate-900 tabular-nums">{health.overall}</span>
        <span className="text-slate-400 text-sm">/100 overall</span>
      </div>
      <ul className="space-y-2.5">
        {health.factors.map((f) => (
          <li key={f.name}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-700">{f.name}</span>
              <span className="text-slate-500 tabular-nums">{f.score}/{f.max}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(f.score / f.max) * 100}%`, background: f.color }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProjectionPanel({ rows, currency }: { rows: NetWorthProjPoint[]; currency: string }) {
  // Render the band as a light area + dashed midline. Render with LineChart for the high band.
  const highLine = rows.map((r) => ({ date: r.month, value: r.high }));
  const lowLine = rows.map((r) => ({ date: r.month, value: r.low }));
  const lastHigh = rows[rows.length - 1]?.high ?? 0;
  const lastLow = rows[rows.length - 1]?.low ?? 0;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-500 uppercase tracking-wider">12-month low</div>
          <div className="text-lg font-semibold text-slate-900 tabular-nums">{fmtMoney(lastLow, currency)}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-500 uppercase tracking-wider">12-month high</div>
          <div className="text-lg font-semibold text-slate-900 tabular-nums">{fmtMoney(lastHigh, currency)}</div>
        </div>
      </div>
      <LineChart data={highLine} height={140} color="#6366f1" />
      <LineChart data={lowLine} height={80} color="#94a3b8" />
    </div>
  );
}

function CategoryForecastTable({ rows, currency }: { rows: CategoryForecast[]; currency: string }) {
  return (
    <ul className="text-sm space-y-1.5">
      {rows.slice(0, 8).map((r) => {
        const delta = r.current > 0 ? ((r.predicted - r.current) / r.current) * 100 : 0;
        const up = delta > 0;
        return (
          <li key={r.category} className="flex items-center justify-between gap-2">
            <span className="truncate text-slate-700">{r.category}</span>
            <span className="flex items-center gap-2 shrink-0 tabular-nums">
              <span className="text-slate-500">{fmtMoney(r.current, currency)}</span>
              <span className="text-slate-300">→</span>
              <span className="text-slate-900 font-medium">{fmtMoney(r.predicted, currency)}</span>
              <span className={`text-xs ${up ? "text-rose-600" : "text-emerald-600"}`}>
                {up ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function BudgetList({ rows, currency }: { rows: BudgetRow[]; currency: string }) {
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const pct = r.budget > 0 ? Math.min(1, r.spent / r.budget) : 0;
        const over = r.budget > 0 && r.spent > r.budget;
        return (
          <li key={r.account}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-700 truncate">{r.category}</span>
              <span className="text-slate-500 tabular-nums">
                {fmtMoney(r.spent, currency)} / {fmtMoney(r.budget, currency)}
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${over ? "bg-rose-500" : "bg-indigo-500"}`} style={{ width: `${pct * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BillsList({ rows, currency }: { rows: Bill[]; currency: string }) {
  return (
    <ul className="text-sm space-y-2">
      {rows.map((b, i) => (
        <li key={i} className="flex items-center justify-between gap-3">
          <span className="flex flex-col min-w-0">
            <span className="text-slate-900 truncate">{b.name}</span>
            <span className="text-xs text-slate-400">
              {b.days_until <= 0 ? "due today" : `in ${b.days_until}d`} · {b.category}
            </span>
          </span>
          <span className="text-slate-700 tabular-nums shrink-0">{fmtMoney(b.amount, currency)}</span>
        </li>
      ))}
    </ul>
  );
}
