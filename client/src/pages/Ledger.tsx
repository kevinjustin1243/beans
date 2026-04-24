import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { invalidateAccounts } from "../lib/accounts";
import { AccountInput } from "../components/AccountInput";
import { TrashIcon, XMarkIcon } from "../components/icons";
import QueryBuilder from "../components/QueryBuilder";

// ─── shared types ────────────────────────────────────────────────────────────

interface LedgerError {
  message: string;
  source: string | null;
}

interface Directive {
  type: string;
  date: string;
  lineno: number | null;
  // open
  account?: string;
  currencies?: string[];
  booking?: string | null;
  // balance
  amount?: string;
  currency?: string;
  // note
  comment?: string;
  // price
  amount_currency?: string;
  // event
  event_type?: string;
  description?: string;
  // pad
  source_account?: string;
  // close — just date + account
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

const inputCls =
  "border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full";

// ─── Errors tab ──────────────────────────────────────────────────────────────

function ErrorsTab() {
  const [errors, setErrors] = useState<LedgerError[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    apiFetch("/api/errors")
      .then((r) => r.json())
      .then((d) => setErrors(d.errors ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <p className="text-slate-400">Checking ledger…</p>;

  if (errors.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex items-center gap-3">
        <svg className="w-6 h-6 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="font-medium text-emerald-800">Ledger is valid</p>
          <p className="text-sm text-emerald-600">No beancount errors found.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <span className="text-sm font-medium text-amber-800">{errors.length} error{errors.length !== 1 ? "s" : ""} detected</span>
        <button onClick={load} className="ml-auto text-xs text-amber-700 hover:underline">Refresh</button>
      </div>

      <div className="space-y-2">
        {errors.map((e, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-sm text-slate-800">{e.message}</p>
            {e.source && (
              <p className="text-xs text-slate-400 font-mono mt-1">{e.source}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}



// ─── Directives tab ───────────────────────────────────────────────────────────

type DirectiveType = "open" | "close" | "balance" | "note" | "price" | "event" | "pad" | "commodity";

const DIRECTIVE_LABELS: Record<DirectiveType, string> = {
  open: "Open",
  close: "Close",
  balance: "Balance",
  note: "Note",
  price: "Price",
  event: "Event",
  pad: "Pad",
  commodity: "Commodity",
};

function DirectiveRow({ d, onDelete }: { d: Directive; onDelete: () => void }) {
  function detail() {
    switch (d.type) {
      case "open":
        return (
          <>
            <span className="font-medium">{d.account}</span>
            {d.currencies && d.currencies.length > 0 && (
              <span className="ml-2 text-xs text-slate-400">{d.currencies.join(", ")}</span>
            )}
          </>
        );
      case "close":
        return <span className="font-medium">{d.account}</span>;
      case "balance":
        return (
          <>
            <span className="font-medium">{d.account}</span>
            <span className="ml-2 font-mono text-slate-500">{d.amount} {d.currency}</span>
          </>
        );
      case "note":
        return (
          <>
            <span className="font-medium">{d.account}</span>
            <span className="ml-2 text-slate-500 italic">"{d.comment}"</span>
          </>
        );
      case "price":
        return (
          <>
            <span className="font-medium">{d.currency}</span>
            <span className="ml-2 font-mono text-slate-500">{d.amount} {d.amount_currency}</span>
          </>
        );
      case "event":
        return (
          <>
            <span className="font-medium">{d.event_type}</span>
            <span className="ml-2 text-slate-500">"{d.description}"</span>
          </>
        );
      case "pad":
        return (
          <>
            <span className="font-medium">{d.account}</span>
            <span className="mx-1 text-slate-400">←</span>
            <span className="text-slate-500">{d.source_account}</span>
          </>
        );
      case "commodity":
        return <span className="font-medium">{d.currency}</span>;
      default:
        return null;
    }
  }

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50 group">
      <td className="px-4 py-2 text-slate-500 text-xs whitespace-nowrap">{d.date}</td>
      <td className="px-4 py-2">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[d.type as DirectiveType] ?? "bg-slate-100 text-slate-500"}`}>
          {d.type}
        </span>
      </td>
      <td className="px-4 py-2 text-sm text-slate-700">{detail()}</td>
      <td className="px-4 py-2 text-right">
        {d.lineno != null && (
          <button
            onClick={onDelete}
            className="md:opacity-0 md:group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-opacity"
            title="Delete"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

const TYPE_BADGE: Record<DirectiveType, string> = {
  open: "bg-emerald-100 text-emerald-700",
  close: "bg-slate-100 text-slate-600",
  balance: "bg-blue-100 text-blue-700",
  note: "bg-yellow-100 text-yellow-700",
  price: "bg-violet-100 text-violet-700",
  event: "bg-pink-100 text-pink-700",
  pad: "bg-orange-100 text-orange-700",
  commodity: "bg-indigo-100 text-indigo-700",
};

function NewDirectiveModal({
  type,
  onClose,
  onSaved,
}: {
  type: DirectiveType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(today());
  const [account, setAccount] = useState("");
  const [currencies, setCurrencies] = useState("USD");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [comment, setComment] = useState("");
  const [amountCurrency, setAmountCurrency] = useState("USD");
  const [eventType, setEventType] = useState("");
  const [description, setDescription] = useState("");
  const [sourceAccount, setSourceAccount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      let body: Record<string, unknown>;
      switch (type) {
        case "open":
          body = { date, account, currencies: currencies.split(/[\s,]+/).filter(Boolean) };
          break;
        case "close":
          body = { date, account };
          break;
        case "balance":
          body = { date, account, amount, currency };
          break;
        case "note":
          body = { date, account, comment };
          break;
        case "price":
          body = { date, currency, amount, amount_currency: amountCurrency };
          break;
        case "event":
          body = { date, event_type: eventType, description };
          break;
        case "pad":
          body = { date, account, source_account: sourceAccount };
          break;
        case "commodity":
          body = { date, currency };
          break;
        default:
          return;
      }
      const r = await apiFetch(`/api/directives/${type}`, { method: "POST", body: JSON.stringify(body) });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.detail ?? "Failed");
      }
      if (type === "open" || type === "close") invalidateAccounts();
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function fields() {
    switch (type) {
      case "open":
        return (
          <>
            <Field label="Account">
              <AccountInput value={account} onChange={setAccount} required placeholder="Assets:Bank:Checking" />
            </Field>
            <Field label="Currencies (space-separated)">
              <input value={currencies} onChange={(e) => setCurrencies(e.target.value)} placeholder="USD" className={inputCls} />
            </Field>
          </>
        );
      case "close":
        return (
          <Field label="Account">
            <AccountInput value={account} onChange={setAccount} required placeholder="Assets:Bank:Checking" />
          </Field>
        );
      case "balance":
        return (
          <>
            <Field label="Account">
              <AccountInput value={account} onChange={setAccount} required placeholder="Assets:Bank:Checking" />
            </Field>
            <div className="flex gap-3">
              <Field label="Amount" className="flex-1">
                <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="1234.56" className={inputCls} />
              </Field>
              <Field label="Currency" className="w-24">
                <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} placeholder="USD" className={inputCls} />
              </Field>
            </div>
          </>
        );
      case "note":
        return (
          <>
            <Field label="Account">
              <AccountInput value={account} onChange={setAccount} required placeholder="Assets:Bank:Checking" />
            </Field>
            <Field label="Note">
              <input value={comment} onChange={(e) => setComment(e.target.value)} required placeholder="Account transferred to new bank" className={inputCls} />
            </Field>
          </>
        );
      case "price":
        return (
          <>
            <Field label="Commodity">
              <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} required placeholder="AAPL" className={inputCls} />
            </Field>
            <div className="flex gap-3">
              <Field label="Price" className="flex-1">
                <input type="number" step="0.0001" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="172.50" className={inputCls} />
              </Field>
              <Field label="Currency" className="w-24">
                <input value={amountCurrency} onChange={(e) => setAmountCurrency(e.target.value.toUpperCase())} placeholder="USD" className={inputCls} />
              </Field>
            </div>
          </>
        );
      case "event":
        return (
          <>
            <Field label="Event type">
              <input value={eventType} onChange={(e) => setEventType(e.target.value)} required placeholder="location" className={inputCls} />
            </Field>
            <Field label="Description">
              <input value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="New York, NY" className={inputCls} />
            </Field>
          </>
        );
      case "pad":
        return (
          <>
            <Field label="Account to pad">
              <AccountInput value={account} onChange={setAccount} required placeholder="Assets:Bank:Checking" />
            </Field>
            <Field label="Source account">
              <AccountInput value={sourceAccount} onChange={setSourceAccount} required placeholder="Equity:Opening-Balances" />
            </Field>
          </>
        );
      case "commodity":
        return (
          <Field label="Currency / commodity symbol">
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} required placeholder="AAPL" className={inputCls} />
          </Field>
        );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            New <span className={`text-xs px-1.5 py-0.5 rounded font-medium ml-1 ${TYPE_BADGE[type]}`}>{type}</span> directive
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
          </Field>

          {fields()}

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

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

const ALL_TYPES: DirectiveType[] = ["open", "close", "balance", "note", "price", "event", "pad", "commodity"];

function DirectivesTab() {
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [filter, setFilter] = useState<DirectiveType | "all">("all");
  const [loading, setLoading] = useState(true);
  const [newType, setNewType] = useState<DirectiveType | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  function load() {
    setLoading(true);
    const url = filter === "all" ? "/api/directives" : `/api/directives?type=${filter}`;
    apiFetch(url)
      .then((r) => r.json())
      .then((d) => setDirectives(d.directives ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [filter]);

  async function handleDelete(lineno: number) {
    await apiFetch(`/api/directives/${lineno}`, { method: "DELETE" });
    setConfirmDelete(null);
    invalidateAccounts();
    load();
  }

  const shown = filter === "all" ? directives : directives.filter((d) => d.type === filter);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 flex-wrap order-2 sm:order-1">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            All
          </button>
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {DIRECTIVE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* New directive type picker */}
      <div className="flex flex-wrap gap-2 mb-4">
        {ALL_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setNewType(t)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${TYPE_BADGE[t]} border-transparent hover:border-current`}
          >
            + {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          {shown.length === 0 ? (
            <p className="p-8 text-center text-slate-400">No {filter === "all" ? "" : filter} directives yet.</p>
          ) : (
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Detail</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {shown.map((d, i) =>
                  confirmDelete === d.lineno ? (
                    <tr key={i} className="border-b border-slate-50 bg-red-50">
                      <td colSpan={4} className="px-4 py-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-red-700">Delete this directive?</span>
                          <button onClick={() => handleDelete(d.lineno!)} className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded">Confirm</button>
                          <button onClick={() => setConfirmDelete(null)} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <DirectiveRow
                      key={i}
                      d={d}
                      onDelete={() => d.lineno != null && setConfirmDelete(d.lineno)}
                    />
                  )
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {newType && (
        <NewDirectiveModal
          type={newType}
          onClose={() => setNewType(null)}
          onSaved={() => { setNewType(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const tabs = ["Errors", "Query", "Directives"] as const;
type Tab = typeof tabs[number];

export default function Ledger() {
  const [tab, setTab] = useState<Tab>("Errors");

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-6">Ledger</h1>

      <div className="flex gap-1 mb-6 sm:mb-8 bg-slate-100 rounded-lg p-1 w-full sm:w-fit">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Errors" && <ErrorsTab />}
      {tab === "Query" && <QueryBuilder />}
      {tab === "Directives" && <DirectivesTab />}
    </div>
  );
}
