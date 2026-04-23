import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { PlusIcon, XMarkIcon } from "../components/icons";

interface AccountNode {
  account: string;
  balance: Record<string, string>;
  children: Record<string, AccountNode>;
}

interface FlatRow {
  account: string;
  totalBalance: Record<string, string>;
  depth: number;
  isLeaf: boolean;
}

// Recursively sum a node's balance including all descendants.
function sumBalances(node: AccountNode): Record<string, string> {
  const totals: Record<string, number> = {};
  for (const [cur, amt] of Object.entries(node.balance)) {
    totals[cur] = (totals[cur] ?? 0) + parseFloat(amt);
  }
  for (const child of Object.values(node.children)) {
    for (const [cur, amt] of Object.entries(sumBalances(child))) {
      totals[cur] = (totals[cur] ?? 0) + parseFloat(amt);
    }
  }
  return Object.fromEntries(
    Object.entries(totals)
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => [k, String(v)])
  );
}

function flatten(node: AccountNode, depth = 0, rows: FlatRow[] = []): FlatRow[] {
  const isLeaf = Object.keys(node.children).length === 0;
  if (node.account) {
    rows.push({ account: node.account, totalBalance: sumBalances(node), depth, isLeaf });
  }
  for (const child of Object.values(node.children)) flatten(child, depth + 1, rows);
  return rows;
}

function fmtUSD(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatBalance(balance: Record<string, string>): string {
  const entries = Object.entries(balance).filter(([, n]) => parseFloat(n) !== 0);
  if (!entries.length) return "—";
  return entries
    .map(([currency, number]) => {
      const n = parseFloat(number);
      if (currency === "USD") return fmtUSD(n);
      return `${n.toFixed(2)} ${currency}`;
    })
    .join(", ");
}

function isTopLevel(account: string): boolean {
  return account.split(":").length === 1;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

export default function Accounts() {
  const [root, setRoot] = useState<AccountNode | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  function load() {
    setLoading(true);
    apiFetch("/api/accounts/balances")
      .then((r) => (r.ok ? r.json() : r.json().then((e: { detail: string }) => Promise.reject(e.detail))))
      .then((data: AccountNode) => setRoot(data))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const rows = root ? flatten(root) : [];

  // Compute net worth summary from root children
  const assetsTotal = root?.children["Assets"] ? sumBalances(root.children["Assets"]) : {};
  const liabTotal = root?.children["Liabilities"] ? sumBalances(root.children["Liabilities"]) : {};
  const assetsUSD = parseFloat(assetsTotal["USD"] ?? "0");
  const liabUSD = parseFloat(liabTotal["USD"] ?? "0"); // negative in beancount
  const netWorth = assetsUSD + liabUSD;
  const hasSummary = root && (assetsUSD !== 0 || liabUSD !== 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Accounts</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Opening Balance
        </button>
      </div>

      {/* Net worth summary */}
      {hasSummary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <SummaryCard
            label="Total Assets"
            value={fmtUSD(assetsUSD)}
            color="text-emerald-600"
          />
          <SummaryCard
            label="Total Liabilities"
            value={fmtUSD(Math.abs(liabUSD))}
            color="text-red-500"
          />
          <SummaryCard
            label="Net Worth"
            value={fmtUSD(netWorth)}
            color={netWorth >= 0 ? "text-emerald-600" : "text-red-500"}
          />
        </div>
      )}

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Account</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.account}
                  className={`border-b border-slate-50 ${
                    isTopLevel(row.account)
                      ? "bg-slate-50"
                      : row.isLeaf
                        ? "hover:bg-slate-50"
                        : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-6 py-2.5">
                    <span
                      style={{ paddingLeft: `${(row.depth - 1) * 16}px` }}
                      className={
                        isTopLevel(row.account)
                          ? "font-semibold text-slate-800"
                          : row.isLeaf
                            ? "text-slate-600"
                            : "font-medium text-slate-700"
                      }
                    >
                      {isTopLevel(row.account)
                        ? row.account
                        : row.account.split(":").pop()}
                    </span>
                    {!isTopLevel(row.account) && (
                      <span className="ml-2 text-xs text-slate-400">{row.account}</span>
                    )}
                  </td>
                  <td className="px-6 py-2.5 text-right font-mono text-slate-700">
                    <span className={!row.isLeaf && !isTopLevel(row.account) ? "text-slate-400 text-xs" : ""}>
                      {formatBalance(row.totalBalance)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <OpeningBalanceModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function OpeningBalanceModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [account, setAccount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const inputCls = "border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full";

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const r = await apiFetch("/api/accounts/opening-balance", {
        method: "POST",
        body: JSON.stringify({ account, currency, amount, date }),
      });
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
          <h2 className="text-lg font-semibold text-slate-900">Opening Balance</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Account name</label>
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              required
              placeholder="e.g. Assets:Bank:Checking"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-400">
              Use <code>Assets:</code> for bank accounts, <code>Liabilities:</code> for credit cards.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Balance</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="e.g. 2500.00 or -847.32"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-slate-400">Negative for credit card debt.</p>
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-slate-600 mb-1">Currency</label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                required
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">As of date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-700 border border-slate-300 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">
              {saving ? "Saving…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
