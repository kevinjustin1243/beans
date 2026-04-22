import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface AccountNode {
  account: string;
  balance: Record<string, string>;
  children: Record<string, AccountNode>;
}

interface BalanceSheet {
  date: string;
  assets: AccountNode;
  liabilities: AccountNode;
  equity: AccountNode;
}

interface IncomeStatement {
  period: { start: string; end: string };
  income: AccountNode;
  expenses: AccountNode;
}

interface TrialRow {
  account: string;
  balance: Record<string, string>;
  depth: number;
}

function formatBalance(balance: Record<string, string>): string {
  const entries = Object.entries(balance).filter(([, n]) => parseFloat(n) !== 0);
  if (!entries.length) return "—";
  return entries
    .map(([currency, number]) => {
      const n = parseFloat(number);
      if (currency === "USD") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
      return `${n.toFixed(2)} ${currency}`;
    })
    .join(", ");
}

function AccountTree({ node, depth = 0 }: { node: AccountNode; depth?: number }) {
  const hasBalance = Object.values(node.balance).some((n) => parseFloat(n) !== 0);
  const hasChildren = Object.keys(node.children).length > 0;
  if (!hasBalance && !hasChildren) return null;

  return (
    <>
      {node.account && (
        <tr className={`border-b border-slate-50 ${depth === 0 ? "bg-slate-50 font-semibold" : "hover:bg-slate-50"}`}>
          <td className="px-4 py-2 text-sm text-slate-700" style={{ paddingLeft: `${16 + depth * 16}px` }}>
            {node.account.split(":").pop()}
            {depth > 0 && <span className="ml-2 text-xs text-slate-400">{node.account}</span>}
          </td>
          <td className="px-4 py-2 text-right text-sm font-mono text-slate-700">{formatBalance(node.balance)}</td>
        </tr>
      )}
      {Object.values(node.children).map((child) => (
        <AccountTree key={child.account} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

function SectionTable({ title, node }: { title: string; node: AccountNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider px-4 py-2 bg-slate-100">{title}</h3>
      <table className="w-full">
        <tbody>
          <AccountTree node={node} depth={0} />
        </tbody>
      </table>
    </div>
  );
}

function BalanceSheetReport() {
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    setError("");
    apiFetch(`/api/reports/balance-sheet?date=${date}`)
      .then((r) => (r.ok ? r.json() : r.json().then((e: { detail: string }) => Promise.reject(e.detail))))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [date]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <label className="text-sm text-slate-600">As of</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {loading ? <p className="text-slate-400">Loading…</p> : data && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <SectionTable title="Assets" node={data.assets} />
          <SectionTable title="Liabilities" node={data.liabilities} />
          <SectionTable title="Equity" node={data.equity} />
        </div>
      )}
    </div>
  );
}

function IncomeStatementReport() {
  const now = new Date();
  const [start, setStart] = useState(`${now.getFullYear()}-01-01`);
  const [end, setEnd] = useState(now.toISOString().slice(0, 10));
  const [data, setData] = useState<IncomeStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    setError("");
    apiFetch(`/api/reports/income-statement?start=${start}&end=${end}`)
      .then((r) => (r.ok ? r.json() : r.json().then((e: { detail: string }) => Promise.reject(e.detail))))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [start, end]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <label className="text-sm text-slate-600">From</label>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <label className="text-sm text-slate-600">To</label>
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {loading ? <p className="text-slate-400">Loading…</p> : data && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <SectionTable title="Income" node={data.income} />
          <SectionTable title="Expenses" node={data.expenses} />
        </div>
      )}
    </div>
  );
}

function TrialBalanceReport() {
  const [rows, setRows] = useState<TrialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/reports/trial-balance")
      .then((r) => (r.ok ? r.json() : r.json().then((e: { detail: string }) => Promise.reject(e.detail))))
      .then((d) => setRows(d.rows))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Account</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.account} className={`border-b border-slate-50 ${row.depth === 1 ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                  <td className="px-4 py-2 text-slate-700" style={{ paddingLeft: `${16 + (row.depth - 1) * 16}px` }}>
                    {row.depth === 1 ? <strong>{row.account}</strong> : row.account}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-700">{formatBalance(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const tabs = ["Balance Sheet", "Income Statement", "Trial Balance"] as const;
type Tab = typeof tabs[number];

export default function Reports() {
  const [tab, setTab] = useState<Tab>("Balance Sheet");

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Reports</h1>

      <div className="flex gap-1 mb-8 bg-slate-100 rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Balance Sheet" && <BalanceSheetReport />}
      {tab === "Income Statement" && <IncomeStatementReport />}
      {tab === "Trial Balance" && <TrialBalanceReport />}
    </div>
  );
}
