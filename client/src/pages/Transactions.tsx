import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { invalidateAccounts } from "../lib/accounts";
import { AccountInput } from "../components/AccountInput";
import { PencilIcon, PlusIcon, TrashIcon, XMarkIcon } from "../components/icons";

interface Posting {
  account: string;
  units: { number: string; currency: string } | null;
}

interface Transaction {
  id: string;
  date: string;
  flag: string;
  payee: string | null;
  narration: string;
  tags: string[];
  postings: Posting[];
}

interface PostingForm {
  account: string;
  amount: string;
  currency: string;
}

const emptyPosting = (): PostingForm => ({ account: "", amount: "", currency: "" });

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatAmount(units: Posting["units"]): string {
  if (!units) return "";
  const n = parseFloat(units.number);
  if (units.currency === "USD")
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  return `${n.toFixed(2)} ${units.currency}`;
}

function postingToForm(p: Posting): PostingForm {
  return {
    account: p.account,
    amount: p.units?.number ?? "",
    currency: p.units?.currency ?? "",
  };
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function buildQuery() {
    const p = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) p.set("narration", search);
    if (filterAccount) p.set("account", filterAccount);
    if (filterStart) p.set("start", filterStart);
    if (filterEnd) p.set("end", filterEnd);
    return p.toString();
  }

  function load() {
    setLoading(true);
    apiFetch(`/api/transactions?${buildQuery()}`)
      .then((r) => (r.ok ? r.json() : r.json().then((e: { detail: string }) => Promise.reject(e.detail))))
      .then((d) => { setTransactions(d.transactions); setTotal(d.total); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [offset, search, filterAccount, filterStart, filterEnd]);

  async function handleDelete(id: string) {
    const r = await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const e = await r.json();
      setError(e.detail ?? "Delete failed");
    } else {
      setConfirmDelete(null);
      invalidateAccounts();
      load();
    }
  }

  function onSaved() {
    setShowAdd(false);
    setEditing(null);
    invalidateAccounts();
    load();
  }

  const pages = Math.ceil(total / limit);
  const page = Math.floor(offset / limit) + 1;

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Transactions</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors shrink-0"
        >
          <PlusIcon className="w-4 h-4" />
          Add
        </button>
      </div>

      <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 sm:gap-3 mb-6">
        <input
          type="text"
          placeholder="Search narration…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-48"
        />
        <div className="sm:w-48">
          <AccountInput
            value={filterAccount}
            onChange={(v) => { setFilterAccount(v); setOffset(0); }}
            placeholder="Filter by account…"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <input type="date" value={filterStart} onChange={(e) => { setFilterStart(e.target.value); setOffset(0); }} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input type="date" value={filterEnd} onChange={(e) => { setFilterEnd(e.target.value); setOffset(0); }} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No transactions found.</div>
        ) : (
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Payee / Narration</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Postings</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50 group">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap align-top">{t.date}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1 rounded font-mono ${t.flag === "!" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{t.flag}</span>
                      <span className="text-slate-800 font-medium">{t.payee ? `${t.payee} — ` : ""}{t.narration}</span>
                    </div>
                    {t.tags.length > 0 && (
                      <div className="mt-1 flex gap-1">
                        {t.tags.map((tag) => (
                          <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">#{tag}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {t.postings.map((p, i) => (
                      <div key={i} className="flex justify-between gap-4 text-xs">
                        <span className="text-slate-500">{p.account}</span>
                        <span className="font-mono text-slate-700">{formatAmount(p.units)}</span>
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {confirmDelete === t.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditing(t)}
                          title="Edit"
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(t.id)}
                          title="Delete"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
          <span>{total} total</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setOffset(offset - limit)} className="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50">←</button>
            <span className="px-3 py-1.5">{page} / {pages}</span>
            <button disabled={page === pages} onClick={() => setOffset(offset + limit)} className="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50">→</button>
          </div>
        </div>
      )}

      {(showAdd || editing) && (
        <TransactionModal
          editing={editing ?? undefined}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

function TransactionModal({
  editing,
  onClose,
  onSaved,
}: {
  editing?: Transaction;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(editing?.date ?? today());
  const [flag, setFlag] = useState(editing?.flag ?? "*");
  const [payee, setPayee] = useState(editing?.payee ?? "");
  const [narration, setNarration] = useState(editing?.narration ?? "");
  const [tags, setTags] = useState(editing?.tags.join(" ") ?? "");
  const [postings, setPostings] = useState<PostingForm[]>(
    editing ? editing.postings.map(postingToForm) : [emptyPosting(), emptyPosting()]
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updatePosting(i: number, field: keyof PostingForm, value: string) {
    setPostings((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const body = {
      date,
      flag,
      payee: payee || null,
      narration,
      tags: tags.split(/[\s,]+/).filter(Boolean),
      postings: postings
        .filter((p) => p.account)
        .map((p) => ({ account: p.account, amount: p.amount || null, currency: p.currency || null })),
    };

    try {
      const url = editing ? `/api/transactions/${editing.id}` : "/api/transactions";
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

  const inputCls = "border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">{editing ? "Edit Transaction" : "New Transaction"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-slate-600 mb-1">Flag</label>
              <select value={flag} onChange={(e) => setFlag(e.target.value)} className={inputCls}>
                <option value="*">* cleared</option>
                <option value="!">! pending</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Payee <span className="text-slate-400">(optional)</span></label>
            <input type="text" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="e.g. Amazon" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Narration</label>
            <input type="text" value={narration} onChange={(e) => setNarration(e.target.value)} required placeholder="e.g. Groceries" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tags <span className="text-slate-400">(space separated)</span></label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. food travel" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Postings</label>
            <div className="space-y-2">
              {postings.map((p, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <AccountInput
                      value={p.account}
                      onChange={(v) => updatePosting(i, "account", v)}
                      placeholder="Account"
                    />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={p.amount}
                    onChange={(e) => updatePosting(i, "amount", e.target.value)}
                    placeholder="Amount"
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-28"
                  />
                  <input
                    type="text"
                    value={p.currency}
                    onChange={(e) => updatePosting(i, "currency", e.target.value.toUpperCase())}
                    placeholder="USD"
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-20"
                  />
                  {postings.length > 2 && (
                    <button type="button" onClick={() => setPostings((prev) => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500 pt-2.5">
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setPostings((prev) => [...prev, emptyPosting()])} className="mt-2 text-sm text-indigo-600 hover:text-indigo-500">
              + Add posting
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-700 border border-slate-300 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">
              {saving ? "Saving…" : editing ? "Save changes" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
