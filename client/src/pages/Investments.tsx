import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import {
  ArrowPathIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "../components/icons";
import { colorFor, DonutChart, LineChart, Sparkline, type Slice } from "../components/charts";

interface Investment {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  cost_basis: number;
  total_cost: number;
  current_price: number | null;
  current_value: number | null;
  gain: number | null;
  gain_percent: number | null;
  day_change: number | null;
  day_change_percent: number | null;
  currency: string;
  fetched_at: string | null;
}

interface HistoryPoint {
  date: string;
  close: number;
}

const inputCls =
  "border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full";

function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtPct(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

function fmtSigned(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return sign + fmtUSD(n);
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso + "Z").getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// ─── Sparkline + history hook ────────────────────────────────────────────────

function useHistory(ticker: string, range = "1mo"): HistoryPoint[] {
  const [data, setData] = useState<HistoryPoint[]>([]);
  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/investments/${ticker}/history?range=${range}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.history) setData(d.history);
      });
    return () => { cancelled = true; };
  }, [ticker, range]);
  return data;
}

function HoldingSparkline({ ticker, gainPositive }: { ticker: string; gainPositive: boolean }) {
  const history = useHistory(ticker, "1mo");
  return <Sparkline values={history.map((p) => p.close)} positive={gainPositive} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Investments() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    apiFetch(`/api/investments${refresh ? "?refresh=true" : ""}`)
      .then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(e.detail))))
      .then((d) => setInvestments(d.investments ?? []))
      .catch((e) => setError(String(e)))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    await apiFetch(`/api/investments/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    load();
  }

  // ─── Derived totals ────────────────────────────────────────────────────────
  const totalValue = investments.reduce((s, i) => s + (i.current_value ?? 0), 0);
  const totalCost = investments.reduce((s, i) => s + i.total_cost, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost ? (totalGain / totalCost) * 100 : 0;
  const totalDayChange = investments.reduce((s, i) => s + (i.day_change ?? 0), 0);
  const totalDayChangePct = totalValue
    ? (totalDayChange / (totalValue - totalDayChange)) * 100
    : 0;

  // ─── Allocation slices (sorted by value desc) ──────────────────────────────
  const sortedByValue = [...investments].sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0));
  const slices: Slice[] = sortedByValue.map((inv, i) => ({
    label: inv.ticker,
    value: inv.current_value ?? 0,
    color: colorFor(i),
  }));

  // ─── Portfolio history (sum over all holdings) ─────────────────────────────
  const portfolioHistory = usePortfolioHistory(investments);

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Investments</h1>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => load(true)}
            disabled={refreshing || investments.length === 0}
            className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
            aria-label="Refresh prices"
          >
            <ArrowPathIcon className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Refresh prices"}</span>
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Add investment</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : investments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400 mb-1">No investments tracked yet.</p>
          <p className="text-sm text-slate-400">
            Add a ticker, the number of shares you hold, and what you paid per share.
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Portfolio Value
              </p>
              <p className="text-2xl font-semibold text-slate-900">{fmtUSD(totalValue)}</p>
              <p className={`text-xs mt-1 ${totalDayChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {fmtSigned(totalDayChange)} ({fmtPct(totalDayChangePct)}) today
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Total Cost
              </p>
              <p className="text-2xl font-semibold text-slate-700">{fmtUSD(totalCost)}</p>
              <p className="text-xs text-slate-400 mt-1">avg basis</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Total Gain/Loss
              </p>
              <p className={`text-2xl font-semibold ${totalGain >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {fmtSigned(totalGain)}
              </p>
              <p className={`text-xs mt-1 ${totalGain >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {fmtPct(totalGainPct)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Holdings
              </p>
              <p className="text-2xl font-semibold text-slate-700">{investments.length}</p>
              <p className="text-xs text-slate-400 mt-1">
                {investments[0]?.fetched_at ? `updated ${timeAgo(investments[0].fetched_at)}` : ""}
              </p>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
            {/* Allocation donut */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Allocation
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="shrink-0">
                  <DonutChart slices={slices} centerValue={fmtUSD(totalValue)} centerLabel="total" />
                </div>
                <ul className="w-full sm:flex-1 space-y-1.5 text-xs">
                  {slices.map((s) => {
                    const pct = totalValue > 0 ? (s.value / totalValue) * 100 : 0;
                    return (
                      <li key={s.label} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                        <span className="font-medium text-slate-700 flex-1">{s.label}</span>
                        <span className="font-mono text-slate-500">{pct.toFixed(1)}%</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            {/* Portfolio value over time */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Portfolio value (1mo)
              </h3>
              <LineChart
                data={portfolioHistory}
                color={totalGain >= 0 ? "#10b981" : "#ef4444"}
              />
            </div>
          </div>

          {/* Holdings table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Ticker</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Shares</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Avg cost</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Price</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Value</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Gain/Loss</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">1mo</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody>
                {sortedByValue.map((inv, idx) => {
                  const gainPositive = (inv.gain ?? 0) >= 0;
                  return (
                    <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50 group">
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: colorFor(idx) }} />
                          <div>
                            <div className="font-semibold text-slate-800">{inv.ticker}</div>
                            <div className="text-xs text-slate-400 truncate max-w-[180px]">{inv.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">{inv.shares}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500">{fmtUSD(inv.cost_basis)}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        <div className="text-slate-700">{fmtUSD(inv.current_price)}</div>
                        {inv.day_change_percent != null && (
                          <div className={`text-xs ${inv.day_change_percent >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {fmtPct(inv.day_change_percent)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                        {fmtUSD(inv.current_value)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <div className={gainPositive ? "text-emerald-600" : "text-red-500"}>
                          {fmtSigned(inv.gain)}
                        </div>
                        <div className={`text-xs ${gainPositive ? "text-emerald-600" : "text-red-500"}`}>
                          {fmtPct(inv.gain_percent)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <HoldingSparkline ticker={inv.ticker} gainPositive={gainPositive} />
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {confirmDelete === inv.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(inv.id)} className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded">Confirm</button>
                            <button onClick={() => setConfirmDelete(null)} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditing(inv)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                              title="Edit"
                            >
                              <PencilIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(inv.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(showAdd || editing) && (
        <InvestmentModal
          editing={editing ?? undefined}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={() => { setShowAdd(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Portfolio history aggregation ────────────────────────────────────────────

function usePortfolioHistory(investments: Investment[]): { date: string; value: number }[] {
  const [histories, setHistories] = useState<Record<string, HistoryPoint[]>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      investments.map((inv) =>
        apiFetch(`/api/investments/${inv.ticker}/history?range=1mo`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => ({ ticker: inv.ticker, history: (d?.history ?? []) as HistoryPoint[] }))
      )
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, HistoryPoint[]> = {};
      for (const r of results) map[r.ticker] = r.history;
      setHistories(map);
    });
    return () => { cancelled = true; };
  }, [investments.map((i) => i.ticker).join(",")]);

  return useMemo(() => {
    if (investments.length === 0) return [];
    // Build date index from union of all histories
    const dateSet = new Set<string>();
    for (const h of Object.values(histories)) for (const p of h) dateSet.add(p.date);
    const dates = [...dateSet].sort();

    // For each ticker, build a date→close lookup with forward-fill
    const lookups: Record<string, Map<string, number>> = {};
    for (const [ticker, hist] of Object.entries(histories)) {
      const m = new Map<string, number>();
      let last: number | null = null;
      const histMap = new Map(hist.map((p) => [p.date, p.close]));
      for (const d of dates) {
        const v = histMap.get(d);
        if (v !== undefined) last = v;
        if (last !== null) m.set(d, last);
      }
      lookups[ticker] = m;
    }

    return dates.map((d) => {
      let total = 0;
      for (const inv of investments) {
        const price = lookups[inv.ticker]?.get(d);
        if (price !== undefined) total += price * inv.shares;
      }
      return { date: d, value: total };
    });
  }, [histories, investments]);
}

// ─── Add/Edit modal ──────────────────────────────────────────────────────────

function InvestmentModal({
  editing,
  onClose,
  onSaved,
}: {
  editing?: Investment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ticker, setTicker] = useState(editing?.ticker ?? "");
  const [shares, setShares] = useState(editing?.shares.toString() ?? "");
  const [costBasis, setCostBasis] = useState(editing?.cost_basis.toString() ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        ticker: ticker.toUpperCase().trim(),
        shares: parseFloat(shares),
        cost_basis: parseFloat(costBasis),
        name: name || null,
      };
      const url = editing ? `/api/investments/${editing.id}` : "/api/investments";
      const method = editing ? "PUT" : "POST";
      const r = await apiFetch(url, { method, body: JSON.stringify(body) });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.detail ?? "Failed to save");
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">{editing ? "Edit Investment" : "Add Investment"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ticker</label>
            <input
              required
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="VOO"
              className={inputCls + " font-mono"}
              disabled={!!editing}
            />
            <p className="text-xs text-slate-400 mt-1">Stock or ETF symbol (e.g. AAPL, VOO, BTC-USD).</p>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Shares</label>
              <input
                required
                type="number"
                step="0.0001"
                min="0"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="10"
                className={inputCls}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Avg cost / share</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={costBasis}
                onChange={(e) => setCostBasis(e.target.value)}
                placeholder="450.00"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Display name <span className="text-slate-400">(optional)</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Auto-filled from ticker if blank"
              className={inputCls}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-700 border border-slate-300 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
