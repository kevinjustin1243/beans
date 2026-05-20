import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { LineChart } from "../components/charts";
import { PencilIcon, PlusIcon, TrashIcon } from "../components/icons";

interface Liability {
  id: string;
  name: string;
  balance: number;
  original_balance: number;
  monthly_payment: number;
  rate: number;
  icon: string | null;
}

interface PayoffPoint {
  month: string;
  balance: number;
}

interface FormState {
  id: string | null;
  name: string;
  balance: string;
  original_balance: string;
  monthly_payment: string;
  rate: string;
  icon: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  balance: "",
  original_balance: "",
  monthly_payment: "",
  rate: "",
  icon: "",
};

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function Liabilities() {
  const [items, setItems] = useState<Liability[]>([]);
  const [payoff, setPayoff] = useState<PayoffPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [list, po] = await Promise.all([
      apiFetch("/api/liabilities").then((r) => (r.ok ? r.json() : { liabilities: [] })),
      apiFetch("/api/liabilities/debt-payoff").then((r) => (r.ok ? r.json() : { payoff: [] })),
    ]);
    setItems(list.liabilities ?? []);
    setPayoff(po.payoff ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(item: Liability) {
    setForm({
      id: item.id,
      name: item.name,
      balance: String(item.balance),
      original_balance: String(item.original_balance),
      monthly_payment: String(item.monthly_payment),
      rate: String(item.rate),
      icon: item.icon ?? "",
    });
    setError(null);
    setShowForm(true);
  }

  async function save() {
    setError(null);
    const payload = {
      name: form.name.trim(),
      balance: parseFloat(form.balance),
      original_balance: parseFloat(form.original_balance) || parseFloat(form.balance),
      monthly_payment: parseFloat(form.monthly_payment),
      rate: parseFloat(form.rate),
      icon: form.icon.trim() || null,
    };
    if (!payload.name || !isFinite(payload.balance) || !isFinite(payload.monthly_payment) || !isFinite(payload.rate)) {
      setError("Fill in name, balance, monthly payment, and rate.");
      return;
    }
    const path = form.id ? `/api/liabilities/${form.id}` : "/api/liabilities";
    const method = form.id ? "PUT" : "POST";
    const res = await apiFetch(path, { method, body: JSON.stringify(payload) });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      setError(detail?.detail ?? "Save failed");
      return;
    }
    setShowForm(false);
    setForm(EMPTY_FORM);
    await load();
  }

  async function remove(item: Liability) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    const res = await apiFetch(`/api/liabilities/${item.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  const totals = useMemo(() => {
    const total = items.reduce((s, l) => s + l.balance, 0);
    const monthly = items.reduce((s, l) => s + l.monthly_payment, 0);
    return { total, monthly };
  }, [items]);

  const payoffLine = useMemo(
    () => payoff.map((p) => ({ date: p.month, value: p.balance })),
    [payoff],
  );

  if (loading) return <div className="p-6 text-slate-400">Loading…</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Total debt" value={fmtMoney(totals.total)} tone="rose" />
        <SummaryCard label="Monthly payments" value={fmtMoney(totals.monthly)} tone="indigo" />
      </div>

      {/* List + add button */}
      <section className="bg-white rounded-xl border border-slate-200">
        <header className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Liabilities</h2>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <PlusIcon className="w-4 h-4" /> Add
          </button>
        </header>
        {items.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm italic">
            No debts tracked. Add a mortgage, auto loan, student loan, or credit-card line.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((it) => {
              const paid = it.original_balance - it.balance;
              const pct = it.original_balance > 0 ? Math.max(0, Math.min(1, paid / it.original_balance)) : 0;
              return (
                <li key={it.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">{it.icon || "💸"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="font-semibold text-slate-900 truncate">{it.name}</div>
                        <div className="text-slate-900 tabular-nums font-medium shrink-0">{fmtMoney(it.balance)}</div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mt-0.5">
                        <span>
                          {fmtMoney(it.monthly_payment)}/mo · {it.rate.toFixed(2)}% APR
                        </span>
                        <span>
                          {fmtMoney(paid)} paid · {(pct * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 mt-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(it)}
                        className="p-1.5 text-slate-400 hover:text-slate-700"
                        aria-label="Edit"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(it)}
                        className="p-1.5 text-slate-400 hover:text-rose-600"
                        aria-label="Delete"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Payoff chart */}
      {payoffLine.length >= 2 && (
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Debt payoff (next 18 months)
          </h2>
          <LineChart data={payoffLine} height={220} color="#10b981" />
        </section>
      )}

      {/* Form modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-xl shadow-lg w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-slate-900 mb-4">
              {form.id ? "Edit liability" : "Add liability"}
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field
                label="Name"
                full
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                placeholder="Mortgage"
              />
              <Field
                label="Current balance"
                value={form.balance}
                onChange={(v) => setForm({ ...form, balance: v })}
                placeholder="245000"
                type="number"
              />
              <Field
                label="Original balance"
                value={form.original_balance}
                onChange={(v) => setForm({ ...form, original_balance: v })}
                placeholder="300000"
                type="number"
              />
              <Field
                label="Monthly payment"
                value={form.monthly_payment}
                onChange={(v) => setForm({ ...form, monthly_payment: v })}
                placeholder="1850"
                type="number"
              />
              <Field
                label="APR (%)"
                value={form.rate}
                onChange={(v) => setForm({ ...form, rate: v })}
                placeholder="6.25"
                type="number"
              />
              <Field
                label="Icon (emoji)"
                full
                value={form.icon}
                onChange={(v) => setForm({ ...form, icon: v })}
                placeholder="🏠"
              />
            </div>
            {error && <div className="text-rose-600 text-sm mt-3">{error}</div>}
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm rounded-md text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {form.id ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "rose" | "indigo" }) {
  const accents = {
    rose: "from-rose-50 to-white border-rose-100",
    indigo: "from-indigo-50 to-white border-indigo-100",
  };
  return (
    <div className={`bg-gradient-to-b ${accents[tone]} border rounded-xl p-4`}>
      <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-xl md:text-2xl font-semibold text-slate-900 mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  full = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="block text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </label>
  );
}
