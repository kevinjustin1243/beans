import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { PlusIcon, TrashIcon } from "../components/icons";

interface WatchlistRow {
  id: string;
  ticker: string;
  note: string | null;
  name: string | null;
  price: number | null;
  change: number | null;
  change_percent: number | null;
  currency: string;
}

function fmtMoney(n: number | null, currency = "USD"): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export default function Watchlist() {
  const [items, setItems] = useState<WatchlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await apiFetch("/api/watchlist");
    const data = await res.json().catch(() => ({ watchlist: [] }));
    setItems(data.watchlist ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    setError(null);
    const t = ticker.trim().toUpperCase();
    if (!t) {
      setError("Enter a ticker symbol.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/watchlist", {
        method: "POST",
        body: JSON.stringify({ ticker: t, note: note.trim() || null }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        setError(detail?.detail ?? "Add failed");
        return;
      }
      setTicker("");
      setNote("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(item: WatchlistRow) {
    if (!confirm(`Remove ${item.ticker} from your watchlist?`)) return;
    const res = await apiFetch(`/api/watchlist/${item.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  if (loading) return <div className="p-6 text-slate-400">Loading…</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Add ticker</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Symbol</span>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="AAPL"
              className="w-32 px-3 py-2 border border-slate-200 rounded-md uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
          </label>
          <label className="block flex-1 min-w-[200px]">
            <span className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Considering for tech allocation"
              className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <button
            onClick={add}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300"
          >
            <PlusIcon className="w-4 h-4" /> Add
          </button>
        </div>
        {error && <div className="text-rose-600 text-sm mt-2">{error}</div>}
      </section>

      <section className="bg-white rounded-xl border border-slate-200">
        <header className="px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
            Watchlist ({items.length})
          </h2>
        </header>
        {items.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm italic">
            Nothing on your watchlist yet. Add a symbol above to track its price.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((it) => {
              const up = (it.change ?? 0) >= 0;
              return (
                <li key={it.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3">
                      <span className="font-semibold text-slate-900 font-mono">{it.ticker}</span>
                      {it.name && <span className="text-sm text-slate-500 truncate">{it.name}</span>}
                    </div>
                    {it.note && <div className="text-xs text-slate-400 mt-0.5 truncate">{it.note}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-medium text-slate-900 tabular-nums">{fmtMoney(it.price, it.currency)}</div>
                    {it.change !== null && it.change_percent !== null && (
                      <div className={`text-xs tabular-nums ${up ? "text-emerald-600" : "text-rose-600"}`}>
                        {up ? "▲" : "▼"} {fmtMoney(Math.abs(it.change), it.currency)} (
                        {it.change_percent.toFixed(2)}%)
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => remove(it)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 shrink-0"
                    aria-label="Remove"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
