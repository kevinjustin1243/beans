import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface AccountNode {
  account: string;
  balance: Record<string, string>;
  children: Record<string, AccountNode>;
}

interface IncomeStatement {
  period: { start: string; end: string };
  income: AccountNode;
  expenses: AccountNode;
}

function primaryBalance(balance: Record<string, string>): number {
  const usd = balance["USD"];
  if (usd !== undefined) return Math.abs(parseFloat(usd));
  const first = Object.values(balance)[0];
  return first ? Math.abs(parseFloat(first)) : 0;
}

function primaryCurrency(balance: Record<string, string>): string {
  return Object.keys(balance)[0] ?? "USD";
}

function fmt(n: number, currency: string): string {
  if (currency === "USD") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  return `${n.toFixed(2)} ${currency}`;
}

function CategoryBar({ label, amount, max, currency }: { label: string; amount: number; max: number; currency: string }) {
  const pct = max > 0 ? (amount / max) * 100 : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-700">{label}</span>
        <span className="font-mono text-slate-600">{fmt(amount, currency)}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthEnd(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function Budget() {
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(monthEnd());
  const [data, setData] = useState<IncomeStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    apiFetch(`/api/reports/income-statement?start=${start}&end=${end}`)
      .then((r) => (r.ok ? r.json() : r.json().then((e: { detail: string }) => Promise.reject(e.detail))))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [start, end]);

  const totalIncome = data ? primaryBalance(data.income.balance) : 0;
  const totalExpenses = data ? primaryBalance(data.expenses.balance) : 0;
  const net = totalIncome - totalExpenses;
  const currency = data ? (primaryCurrency(data.expenses.balance) || "USD") : "USD";

  const categories = data
    ? Object.values(data.expenses.children)
        .map((node) => ({ label: node.account.split(":").pop()!, amount: primaryBalance(node.balance) }))
        .filter((c) => c.amount > 0)
        .sort((a, b) => b.amount - a.amount)
    : [];

  const maxCategory = categories[0]?.amount ?? 1;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Budget</h1>
        <div className="flex items-center gap-3 text-sm">
          <label className="text-slate-500">From</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <label className="text-slate-500">To</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Income</p>
              <p className="text-2xl font-semibold text-emerald-600">{fmt(totalIncome, currency)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Expenses</p>
              <p className="text-2xl font-semibold text-red-500">{fmt(totalExpenses, currency)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Net</p>
              <p className={`text-2xl font-semibold ${net >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(net, currency)}</p>
            </div>
          </div>

          {/* Spending breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-5">Spending by Category</h2>
            {categories.length === 0 ? (
              <p className="text-slate-400">No expenses in this period.</p>
            ) : (
              categories.map((c) => (
                <CategoryBar key={c.label} label={c.label} amount={c.amount} max={maxCategory} currency={currency} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
