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

interface FlatAccount {
  account: string;
  label: string;
  amount: number;
  currency: string;
  depth: number;
}

function primaryBalance(balance: Record<string, string>): number {
  const usd = balance["USD"];
  if (usd !== undefined) return Math.abs(parseFloat(usd));
  const first = Object.values(balance)[0];
  return first ? Math.abs(parseFloat(first)) : 0;
}

function detectCurrency(node: AccountNode): string {
  const own = Object.keys(node.balance)[0];
  if (own) return own;
  for (const child of Object.values(node.children)) {
    const c = detectCurrency(child);
    if (c !== "USD" || Object.keys(child.balance).length > 0) return c;
  }
  return "USD";
}

function aggregateBalance(node: AccountNode): number {
  let total = primaryBalance(node.balance);
  for (const child of Object.values(node.children)) {
    total += aggregateBalance(child);
  }
  return total;
}

function fmt(n: number, currency: string): string {
  if (currency === "USD")
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  return `${n.toFixed(2)} ${currency}`;
}

function flattenNode(node: AccountNode, currency: string, depth = 0): FlatAccount[] {
  const results: FlatAccount[] = [];
  if (node.account && depth > 0) {
    results.push({
      account: node.account,
      label: node.account.split(":").pop()!,
      amount: aggregateBalance(node),
      currency,
      depth,
    });
  }
  for (const child of Object.values(node.children).sort((a, b) =>
    a.account.localeCompare(b.account)
  )) {
    results.push(...flattenNode(child, currency, depth + 1));
  }
  return results;
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
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    apiFetch(`/api/reports/income-statement?start=${start}&end=${end}`)
      .then((r) =>
        r.ok ? r.json() : r.json().then((e: { detail: string }) => Promise.reject(e.detail))
      )
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [start, end]);

  useEffect(() => {
    apiFetch("/api/budget/targets")
      .then((r) => r.json())
      .then((d) => setTargets(d.targets ?? {}));
  }, []);

  async function commitTarget(account: string, value: string) {
    const n = parseFloat(value);
    if (isNaN(n) || n <= 0) {
      await apiFetch(`/api/budget/targets/${encodeURIComponent(account)}`, { method: "DELETE" });
      setTargets((prev) => {
        const next = { ...prev };
        delete next[account];
        return next;
      });
    } else {
      await apiFetch(`/api/budget/targets/${encodeURIComponent(account)}`, {
        method: "PUT",
        body: JSON.stringify({ amount: n }),
      });
      setTargets((prev) => ({ ...prev, [account]: n }));
    }
    setEditingTarget(null);
  }

  const totalIncome = data ? aggregateBalance(data.income) : 0;
  const totalExpenses = data ? aggregateBalance(data.expenses) : 0;
  const available = totalIncome - totalExpenses;
  const currency = data ? detectCurrency(data.expenses) : "USD";

  const flatExpenses = data
    ? flattenNode(data.expenses, currency).filter((a) => a.amount > 0)
    : [];
  const maxAmount = Math.max(...flatExpenses.map((a) => a.amount), 1);

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Budget</h1>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 text-sm">
          <label className="text-slate-500 hidden sm:inline">From</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <label className="text-slate-500 hidden sm:inline">To</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                  Income
                </p>
                <p className="text-2xl font-semibold text-emerald-600">
                  {fmt(totalIncome, currency)}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                  Spent
                </p>
                <p className="text-2xl font-semibold text-red-500">
                  {fmt(totalExpenses, currency)}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                  Available for Spending
                </p>
                <p
                  className={`text-2xl font-semibold ${available >= 0 ? "text-emerald-600" : "text-red-500"}`}
                >
                  {fmt(Math.abs(available), currency)}
                </p>
                {available < 0 && (
                  <p className="text-xs text-red-400 mt-0.5">over by {fmt(-available, currency)}</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                  Spending by Category
                </h2>
                <p className="text-xs text-slate-400">Click a row to set a target</p>
              </div>

              {flatExpenses.length === 0 ? (
                <p className="text-slate-400">No expenses in this period.</p>
              ) : (
                <div className="space-y-0.5">
                  {flatExpenses.map((acct) => {
                    const target = targets[acct.account];
                    const pct = target
                      ? Math.min((acct.amount / target) * 100, 100)
                      : (acct.amount / maxAmount) * 100;
                    const over = target !== undefined && acct.amount > target;
                    const barColor = !target
                      ? "bg-slate-300"
                      : over
                        ? "bg-red-400"
                        : pct > 80
                          ? "bg-amber-400"
                          : "bg-emerald-400";
                    const isEditing = editingTarget === acct.account;

                    return (
                      <div
                        key={acct.account}
                        className="py-2.5 cursor-pointer hover:bg-slate-50 rounded-lg px-2 -mx-2"
                        style={{ paddingLeft: `${(acct.depth - 1) * 20 + 8}px` }}
                        onClick={() => {
                          if (editingTarget !== acct.account) {
                            setEditingTarget(acct.account);
                            setEditValue(target ? String(target) : "");
                          }
                        }}
                      >
                        <div className="flex items-center justify-between text-sm mb-1.5 gap-2">
                          <span className="text-slate-700 truncate flex-1 font-medium">
                            {acct.label}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-slate-600">
                              {fmt(acct.amount, acct.currency)}
                            </span>
                            {isEditing ? (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  commitTarget(acct.account, editValue);
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-400">/</span>
                                  <input
                                    autoFocus
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => commitTarget(acct.account, editValue)}
                                    placeholder="target"
                                    className="border border-indigo-400 rounded px-2 py-0.5 text-xs w-24 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                              </form>
                            ) : (
                              <span className="text-xs font-mono text-slate-400">
                                {target ? `/ ${fmt(target, acct.currency)}` : "+ target"}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${barColor} rounded-full transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {over && (
                          <p className="text-xs text-red-400 mt-0.5 text-right">
                            {fmt(acct.amount - target!, acct.currency)} over
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}
