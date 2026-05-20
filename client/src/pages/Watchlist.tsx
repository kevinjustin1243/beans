import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { Sparkline } from "../components/charts";
import { PencilIcon, PlusIcon, TrashIcon } from "../components/icons";

interface WatchlistRow {
  id: string;
  ticker: string;
  note: string | null;
  name: string | null;
  price: number | null;
  change: number | null;
  change_percent: number | null;
  currency: string;
  spark: number[];
  alert_above: number | null;
  alert_below: number | null;
  alert_triggered: boolean;
}

interface EditForm {
  id: string;
  note: string;
  alert_above: string;
  alert_below: string;
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
  const [editing, setEditing] = useState<EditForm | null>(null);

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

  function openEdit(item: WatchlistRow) {
    setEditing({
      id: item.id,
      note: item.note ?? "",
      alert_above: item.alert_above !== null ? String(item.alert_above) : "",
      alert_below: item.alert_below !== null ? String(item.alert_below) : "",
    });
  }

  async function saveEdit() {
    if (!editing) return;
    const above = parseFloat(editing.alert_above);
    const below = parseFloat(editing.alert_below);
    const body = {
      note: editing.note.trim() || null,
      alert_above: isFinite(above) && above > 0 ? above : null,
      alert_below: isFinite(below) && below > 0 ? below : null,
    };
    const res = await apiFetch(`/api/watchlist/${editing.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setEditing(null);
      await load();
    }
  }

  if (loading) return <div className="p-6 text-slate-400">Loading…</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
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
                <li
                  key={it.id}
                  className={`px-5 py-4 flex items-center gap-4 ${it.alert_triggered ? "bg-amber-50" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3">
                      <span className="font-semibold text-slate-900 font-mono">{it.ticker}</span>
                      {it.name && <span className="text-sm text-slate-500 truncate">{it.name}</span>}
                      {it.alert_triggered && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">
                          alert
                        </span>
                      )}
                    </div>
                    {it.note && <div className="text-xs text-slate-400 mt-0.5 truncate">{it.note}</div>}
                    {(it.alert_above !== null || it.alert_below !== null) && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {it.alert_above !== null && <>alert ≥ {fmtMoney(it.alert_above, it.currency)}</>}
                        {it.alert_above !== null && it.alert_below !== null && " · "}
                        {it.alert_below !== null && <>alert ≤ {fmtMoney(it.alert_below, it.currency)}</>}
                      </div>
                    )}
                  </div>

                  {it.spark.length >= 2 && (
                    <Sparkline values={it.spark} width={80} height={28} positive={up} />
                  )}

                  <div className="text-right shrink-0 w-24">
                    <div className="font-medium text-slate-900 tabular-nums">{fmtMoney(it.price, it.currency)}</div>
                    {it.change !== null && it.change_percent !== null && (
                      <div className={`text-xs tabular-nums ${up ? "text-emerald-600" : "text-rose-600"}`}>
                        {up ? "▲" : "▼"} {it.change_percent.toFixed(2)}%
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(it)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600"
                      aria-label="Edit alerts"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(it)}
                      className="p-1.5 text-slate-400 hover:text-rose-600"
                      aria-label="Remove"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setEditing(null)}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Edit watchlist entry</h3>
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Note</span>
                <input
                  type="text"
                  value={editing.note}
                  onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Alert ≥</span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={editing.alert_above}
                    onChange={(e) => setEditing({ ...editing, alert_above: e.target.value })}
                    placeholder="e.g. 200"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Alert ≤</span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={editing.alert_below}
                    onChange={(e) => setEditing({ ...editing, alert_below: e.target.value })}
                    placeholder="e.g. 150"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-400">
                Leave a field blank to clear the alert.
              </p>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm rounded-md text-slate-700 hover:bg-slate-100">
                Cancel
              </button>
              <button onClick={saveEdit} className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
