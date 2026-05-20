import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { LineChart } from "../components/charts";
import { TrashIcon } from "../components/icons";

interface ScoreEntry {
  id: number;
  month: string; // YYYY-MM-DD
  score: number;
}

// Treat 850 as the upper bound and 300 as the lower bound (FICO range).
function scoreBand(score: number): { label: string; tone: string } {
  if (score >= 800) return { label: "Exceptional", tone: "text-emerald-600" };
  if (score >= 740) return { label: "Very good", tone: "text-emerald-600" };
  if (score >= 670) return { label: "Good", tone: "text-indigo-600" };
  if (score >= 580) return { label: "Fair", tone: "text-amber-600" };
  return { label: "Poor", tone: "text-rose-600" };
}

function fmtMonthLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function todayMonthInput(): string {
  // YYYY-MM for the <input type="month">
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function CreditScore() {
  const [history, setHistory] = useState<ScoreEntry[]>([]);
  const [month, setMonth] = useState<string>(todayMonthInput());
  const [score, setScore] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await apiFetch("/api/credit/history");
    const data = await res.json().catch(() => ({ history: [] }));
    setHistory(data.history ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setError(null);
    const n = parseInt(score, 10);
    if (!isFinite(n) || n < 300 || n > 850) {
      setError("Score must be between 300 and 850.");
      return;
    }
    const isoMonth = `${month}-01`;
    const res = await apiFetch("/api/credit", {
      method: "POST",
      body: JSON.stringify({ month: isoMonth, score: n }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      setError(detail?.detail ?? "Save failed");
      return;
    }
    setScore("");
    await load();
  }

  async function remove(entry: ScoreEntry) {
    if (!confirm(`Delete the entry for ${fmtMonthLabel(entry.month)}?`)) return;
    const res = await apiFetch(`/api/credit/${entry.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  const latest = history[history.length - 1];
  const band = latest ? scoreBand(latest.score) : null;
  const trendLine = useMemo(
    () => history.map((h) => ({ date: fmtMonthLabel(h.month), value: h.score })),
    [history],
  );

  if (loading) return <div className="p-6 text-slate-400">Loading…</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Current score</h2>
        {latest ? (
          <div className="flex items-baseline gap-4">
            <span className="text-5xl font-semibold text-slate-900 tabular-nums">{latest.score}</span>
            <div>
              <div className={`text-sm font-medium ${band!.tone}`}>{band!.label}</div>
              <div className="text-xs text-slate-400">{fmtMonthLabel(latest.month)}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-400 italic">No scores recorded yet.</div>
        )}
      </section>

      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Record a new score</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Score (300-850)</span>
            <input
              type="number"
              min={300}
              max={850}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="720"
              className="w-40 px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <button
            onClick={save}
            className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
        {error && <div className="text-rose-600 text-sm mt-2">{error}</div>}
        <p className="text-xs text-slate-400 mt-3">
          Recording a second score in the same month replaces the prior entry.
        </p>
      </section>

      {trendLine.length >= 2 && (
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">History</h2>
          <LineChart data={trendLine} height={220} color="#06b6d4" />
        </section>
      )}

      {history.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200">
          <header className="px-5 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">All entries</h2>
          </header>
          <ul className="divide-y divide-slate-100">
            {[...history].reverse().map((entry) => (
              <li key={entry.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-slate-700">{fmtMonthLabel(entry.month)}</span>
                <span className="flex items-center gap-3">
                  <span className="text-slate-900 tabular-nums font-medium">{entry.score}</span>
                  <button
                    onClick={() => remove(entry)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                    aria-label="Delete"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
