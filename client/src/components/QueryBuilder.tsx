import { useCallback, useMemo, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { AccountInput } from "./AccountInput";

// ─── types ────────────────────────────────────────────────────────────────────

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

interface Builder {
  fields: string[];
  aggr: string;
  acctFilter: string;
  acctMode: "contains" | "exact" | "type";
  acctType: string;
  dateFrom: string;
  dateTo: string;
  flag: string;
  payee: string;
  narration: string;
  tag: string;
  groupBy: boolean;
  groupFields: string[];
  orderField: string;
  orderDir: "ASC" | "DESC";
  limit: string;
}

// ─── constants ────────────────────────────────────────────────────────────────

const PLAIN_FIELDS = [
  { id: "date", label: "Date" },
  { id: "year", label: "Year" },
  { id: "month", label: "Month" },
  { id: "flag", label: "Flag" },
  { id: "payee", label: "Payee" },
  { id: "narration", label: "Narration" },
  { id: "account", label: "Account" },
  { id: "tags", label: "Tags" },
  { id: "links", label: "Links" },
];

const AGGR_OPTIONS = [
  { id: "", label: "None" },
  { id: "sum(position)", label: "sum(position)" },
  { id: "sum(balance)", label: "sum(balance)" },
  { id: "count", label: "count" },
  { id: "first(date)", label: "first(date)" },
  { id: "last(date)", label: "last(date)" },
];

const ACCOUNT_TYPES = ["Assets", "Liabilities", "Income", "Expenses", "Equity"];

const ORDER_FIELD_OPTIONS = [
  ...PLAIN_FIELDS.map((f) => f.id),
  "sum(position)",
  "sum(balance)",
  "count",
  "first(date)",
  "last(date)",
];

// ─── BQL generation ───────────────────────────────────────────────────────────

function builderToBQL(b: Builder): string {
  const sel = [...b.fields, ...(b.aggr ? [b.aggr] : [])];
  const selectPart = sel.length ? sel.join(", ") : "*";

  const conds: string[] = [];
  if (b.acctMode === "contains" && b.acctFilter)
    conds.push(`account ~ "${b.acctFilter}"`);
  else if (b.acctMode === "exact" && b.acctFilter)
    conds.push(`account = "${b.acctFilter}"`);
  else if (b.acctMode === "type")
    conds.push(`account_type = "${b.acctType}"`);
  if (b.dateFrom) conds.push(`date >= ${b.dateFrom}`);
  if (b.dateTo) conds.push(`date <= ${b.dateTo}`);
  if (b.flag) conds.push(`flag = "${b.flag}"`);
  if (b.payee) conds.push(`payee ~ "${b.payee}"`);
  if (b.narration) conds.push(`narration ~ "${b.narration}"`);
  if (b.tag) conds.push(`tag = "${b.tag}"`);

  let bql = `SELECT ${selectPart}`;
  if (conds.length) bql += `\nWHERE ${conds.join("\n  AND ")}`;
  if (b.groupBy && b.groupFields.length) bql += `\nGROUP BY ${b.groupFields.join(", ")}`;
  if (b.orderField) bql += `\nORDER BY ${b.orderField} ${b.orderDir}`;
  if (b.limit && b.limit !== "0") bql += `\nLIMIT ${b.limit}`;
  return bql;
}

function defaultBuilder(): Builder {
  return {
    fields: ["account"],
    aggr: "sum(position)",
    acctFilter: "",
    acctMode: "contains",
    acctType: "Expenses",
    dateFrom: "",
    dateTo: "",
    flag: "",
    payee: "",
    narration: "",
    tag: "",
    groupBy: true,
    groupFields: ["account"],
    orderField: "account",
    orderDir: "ASC",
    limit: "1000",
  };
}

// ─── cell formatting ──────────────────────────────────────────────────────────

function formatCell(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (
    typeof val === "object" &&
    val !== null &&
    "number" in val &&
    "currency" in val
  ) {
    const v = val as { number: string; currency: string };
    const n = parseFloat(v.number);
    if (v.currency === "USD")
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(n);
    return `${n.toFixed(4)} ${v.currency}`;
  }
  if (Array.isArray(val)) return val.length ? val.join(", ") : "—";
  return String(val);
}

function sortValue(val: unknown): string | number {
  if (val === null || val === undefined) return "";
  if (
    typeof val === "object" &&
    "number" in (val as object) &&
    "currency" in (val as object)
  ) {
    return parseFloat((val as { number: string }).number);
  }
  if (typeof val === "number") return val;
  return String(val);
}

function exportCSV(result: QueryResult) {
  const header = result.columns.join(",");
  const rows = result.rows.map((row) =>
    result.columns
      .map((col) => {
        const s = formatCell(row[col]);
        return `"${s.replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "query.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── small UI pieces ──────────────────────────────────────────────────────────

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-600"
      }`}
    >
      {label}
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

const inputCls =
  "border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full";
const selectCls = inputCls + " bg-white";

// ─── BuilderPanel ─────────────────────────────────────────────────────────────

function BuilderPanel({
  b,
  set,
}: {
  b: Builder;
  set: (patch: Partial<Builder>) => void;
}) {
  function toggleField(id: string) {
    const next = b.fields.includes(id)
      ? b.fields.filter((f) => f !== id)
      : [...b.fields, id];
    set({ fields: next });
  }

  function toggleGroupField(id: string) {
    const next = b.groupFields.includes(id)
      ? b.groupFields.filter((f) => f !== id)
      : [...b.groupFields, id];
    set({ groupFields: next });
  }

  return (
    <div className="space-y-1 lg:pr-6 lg:border-r border-slate-200 h-full overflow-y-auto">
      {/* SELECT */}
      <Section title="SELECT">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PLAIN_FIELDS.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              active={b.fields.includes(f.id)}
              onClick={() => toggleField(f.id)}
            />
          ))}
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Aggregation</label>
          <select
            value={b.aggr}
            onChange={(e) => set({ aggr: e.target.value })}
            className={selectCls}
          >
            {AGGR_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </Section>

      {/* WHERE */}
      <Section title="WHERE">
        <div className="space-y-2">
          {/* Account filter */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Account</label>
            <div className="flex gap-1 mb-1">
              {(["contains", "exact", "type"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set({ acctMode: m })}
                  className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                    b.acctMode === m
                      ? "bg-slate-700 text-white border-slate-700"
                      : "bg-white text-slate-500 border-slate-300 hover:border-slate-400"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {b.acctMode === "type" ? (
              <select
                value={b.acctType}
                onChange={(e) => set({ acctType: e.target.value })}
                className={selectCls}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            ) : (
              <AccountInput
                value={b.acctFilter}
                onChange={(v) => set({ acctFilter: v })}
                placeholder={b.acctMode === "exact" ? "Assets:Bank:Checking" : "Expenses"}
              />
            )}
          </div>

          {/* Date range */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">From date</label>
              <input
                type="date"
                value={b.dateFrom}
                onChange={(e) => set({ dateFrom: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">To date</label>
              <input
                type="date"
                value={b.dateTo}
                onChange={(e) => set({ dateTo: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          {/* Flag */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Flag</label>
            <div className="flex gap-1">
              {[
                { v: "", label: "Any" },
                { v: "*", label: "* cleared" },
                { v: "!", label: "! pending" },
              ].map(({ v, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set({ flag: v })}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    b.flag === v
                      ? "bg-slate-700 text-white border-slate-700"
                      : "bg-white text-slate-500 border-slate-300 hover:border-slate-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Payee / Narration / Tag */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Payee contains</label>
            <input
              value={b.payee}
              onChange={(e) => set({ payee: e.target.value })}
              placeholder="Amazon"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Narration contains</label>
            <input
              value={b.narration}
              onChange={(e) => set({ narration: e.target.value })}
              placeholder="Groceries"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Tag</label>
            <input
              value={b.tag}
              onChange={(e) => set({ tag: e.target.value })}
              placeholder="travel"
              className={inputCls}
            />
          </div>
        </div>
      </Section>

      {/* GROUP BY */}
      <Section title="GROUP BY">
        <label className="flex items-center gap-2 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={b.groupBy}
            onChange={(e) => set({ groupBy: e.target.checked })}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-xs text-slate-600">Enable grouping</span>
        </label>
        {b.groupBy && (
          <div className="flex flex-wrap gap-1.5">
            {PLAIN_FIELDS.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                active={b.groupFields.includes(f.id)}
                onClick={() => toggleGroupField(f.id)}
              />
            ))}
          </div>
        )}
      </Section>

      {/* ORDER BY */}
      <Section title="ORDER BY / LIMIT">
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Order by</label>
            <select
              value={b.orderField}
              onChange={(e) => set({ orderField: e.target.value })}
              className={selectCls}
            >
              <option value="">— none —</option>
              {ORDER_FIELD_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label className="block text-xs text-slate-500 mb-1">Direction</label>
            <div className="flex h-[34px]">
              {(["ASC", "DESC"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set({ orderDir: d })}
                  className={`flex-1 text-xs font-medium border transition-colors first:rounded-l-lg last:rounded-r-lg ${
                    b.orderDir === d
                      ? "bg-slate-700 text-white border-slate-700"
                      : "bg-white text-slate-500 border-slate-300 hover:border-slate-400"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Limit rows</label>
          <input
            type="number"
            min="1"
            value={b.limit}
            onChange={(e) => set({ limit: e.target.value })}
            className={inputCls}
          />
        </div>
      </Section>
    </div>
  );
}

// ─── ResultsTable ─────────────────────────────────────────────────────────────

function ResultsTable({ result }: { result: QueryResult }) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const rows = useMemo(() => {
    if (!sortCol) return result.rows;
    return [...result.rows].sort((a, b) => {
      const va = sortValue(a[sortCol]);
      const vb = sortValue(b[sortCol]);
      let cmp: number;
      if (typeof va === "number" && typeof vb === "number") {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [result, sortCol, sortDir]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">
          {result.rows.length} row{result.rows.length !== 1 ? "s" : ""}
          {sortCol && (
            <span className="ml-2 text-indigo-400">
              sorted by {sortCol} {sortDir === "asc" ? "↑" : "↓"}
            </span>
          )}
        </span>
        <button
          onClick={() => exportCSV(result)}
          className="text-xs text-slate-500 hover:text-indigo-600 border border-slate-300 hover:border-indigo-400 px-2.5 py-1 rounded-lg transition-colors"
        >
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {result.rows.length === 0 ? (
          <p className="p-8 text-center text-slate-400">No results.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {result.columns.map((col) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-indigo-600 hover:bg-slate-50 select-none transition-colors"
                  >
                    {col}
                    {sortCol === col && (
                      <span className="ml-1 text-indigo-400">
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                  {result.columns.map((col) => (
                    <td key={col} className="px-4 py-2 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {formatCell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QueryBuilder() {
  const [mode, setMode] = useState<"builder" | "raw">("builder");
  const [builder, setBuilder] = useState<Builder>(defaultBuilder());
  const [rawBql, setRawBql] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState("");
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const rawRef = useRef<HTMLTextAreaElement>(null);

  const generatedBql = builderToBQL(builder);
  const activeBql = mode === "builder" ? generatedBql : rawBql;

  const patch = useCallback((p: Partial<Builder>) => setBuilder((b) => ({ ...b, ...p })), []);

  async function run() {
    if (!activeBql.trim()) return;
    setRunning(true);
    setQueryError("");
    setResult(null);
    try {
      const r = await apiFetch("/api/query", {
        method: "POST",
        body: JSON.stringify({ bql: activeBql }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Query failed");
      setResult(d);
    } catch (err: unknown) {
      setQueryError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  function switchToRaw() {
    setRawBql(generatedBql);
    setMode("raw");
  }

  function copyBql() {
    navigator.clipboard.writeText(activeBql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setMode("builder")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === "builder"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Builder
          </button>
          <button
            onClick={switchToRaw}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === "raw"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Raw BQL
          </button>
        </div>

        <button
          onClick={run}
          disabled={running}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {running ? "Running…" : "Run"}
        </button>
      </div>

      {/* Builder mode: stacks on mobile, two-column on lg */}
      {mode === "builder" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 bg-white rounded-xl border border-slate-200 mb-4 overflow-hidden">
          {/* Builder form */}
          <div className="lg:col-span-2 p-4 sm:p-5 overflow-y-auto lg:max-h-[520px]">
            <BuilderPanel b={builder} set={patch} />
          </div>

          {/* BQL preview */}
          <div className="lg:col-span-3 bg-slate-950 flex flex-col min-h-[200px]">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
              <span className="text-xs text-slate-400 font-mono">Generated BQL</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyBql}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={switchToRaw}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Edit raw →
                </button>
              </div>
            </div>
            <pre className="flex-1 px-5 py-4 text-sm font-mono text-emerald-300 whitespace-pre-wrap leading-relaxed overflow-auto">
              {generatedBql}
            </pre>
          </div>
        </div>
      )}

      {/* Raw mode: full-width textarea */}
      {mode === "raw" && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-mono">BQL</span>
            <button
              onClick={copyBql}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <textarea
            ref={rawRef}
            value={rawBql}
            onChange={(e) => setRawBql(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
            }}
            rows={6}
            spellCheck={false}
            className="w-full rounded-xl bg-slate-950 text-emerald-300 font-mono text-sm px-5 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y leading-relaxed"
            placeholder={`SELECT account, sum(position)\nWHERE account_type = "Expenses"\nGROUP BY account\nORDER BY sum(position) DESC`}
          />
          <p className="text-xs text-slate-400 mt-1">⌘↵ to run</p>
        </div>
      )}

      {/* Error */}
      {queryError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-red-700 font-mono whitespace-pre-wrap">{queryError}</p>
        </div>
      )}

      {/* Results */}
      {result && <ResultsTable result={result} />}
    </div>
  );
}
