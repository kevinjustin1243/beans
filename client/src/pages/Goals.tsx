import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  currency: string;
  account: string;
  manual_current: number;
}

interface GoalWithCurrent extends Goal {
  current: number;
}

function fmt(n: number, currency: string): string {
  if (currency === "USD")
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  return `${n.toFixed(2)} ${currency}`;
}

function emptyGoal(): Omit<Goal, "id"> {
  return { name: "", target_amount: 0, currency: "USD", account: "", manual_current: 0 };
}

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  function fetchGoals() {
    apiFetch("/api/goals")
      .then((r) => r.json())
      .then((d) => setGoals(d.goals ?? []));
  }

  useEffect(() => {
    fetchGoals();
  }, []);

  useEffect(() => {
    const linked = goals.filter((g) => g.account);
    Promise.all(
      linked.map((g) =>
        apiFetch(`/api/accounts/${g.account}/balance`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) =>
            d
              ? { account: g.account, amount: Math.abs(parseFloat(d.balance?.[g.currency] ?? "0")) }
              : null
          )
      )
    ).then((results) => {
      const map: Record<string, number> = {};
      for (const r of results) {
        if (r) map[r.account] = r.amount;
      }
      setBalances(map);
    });
  }, [goals]);

  const withCurrent: GoalWithCurrent[] = goals.map((g) => ({
    ...g,
    current: g.account ? (balances[g.account] ?? 0) : g.manual_current,
  }));

  async function handleSave(body: Omit<Goal, "id">, id?: string) {
    if (id) {
      await apiFetch(`/api/goals/${id}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await apiFetch("/api/goals", { method: "POST", body: JSON.stringify(body) });
    }
    fetchGoals();
    setShowAdd(false);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    await apiFetch(`/api/goals/${id}`, { method: "DELETE" });
    fetchGoals();
  }

  const totalSaved = withCurrent.reduce((s, g) => s + Math.min(g.current, g.target_amount), 0);
  const totalTarget = withCurrent.reduce((s, g) => s + g.target_amount, 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Goals</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add goal
        </button>
      </div>

      {goals.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Total Saved
            </p>
            <p className="text-2xl font-semibold text-emerald-600">{fmt(totalSaved, "USD")}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Total Target
            </p>
            <p className="text-2xl font-semibold text-slate-700">{fmt(totalTarget, "USD")}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Still Needed
            </p>
            <p className="text-2xl font-semibold text-amber-500">
              {fmt(Math.max(totalTarget - totalSaved, 0), "USD")}
            </p>
          </div>
        </div>
      )}

      {withCurrent.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400 mb-1">No goals yet.</p>
          <p className="text-sm text-slate-400">
            Track savings goals and optionally link them to a ledger account.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {withCurrent.map((g) => {
            const pct =
              g.target_amount > 0 ? Math.min((g.current / g.target_amount) * 100, 100) : 0;
            const done = g.current >= g.target_amount;
            const remaining = Math.max(g.target_amount - g.current, 0);

            return (
              <div key={g.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">{g.name}</h3>
                    {g.account && (
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">{g.account}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditing(g)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${done ? "bg-emerald-400" : "bg-indigo-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 font-mono">{fmt(g.current, g.currency)}</span>
                  <span>
                    {done ? (
                      <span className="text-emerald-600 font-medium">Goal reached!</span>
                    ) : (
                      <>
                        <span className="font-mono text-slate-500">
                          {fmt(remaining, g.currency)}
                        </span>
                        <span className="text-slate-400"> to go · </span>
                        <span className="text-slate-500">{pct.toFixed(0)}%</span>
                      </>
                    )}
                  </span>
                  <span className="text-slate-400 font-mono">
                    {fmt(g.target_amount, g.currency)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(showAdd || editing) && (
        <GoalModal
          editing={editing ?? undefined}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function GoalModal({
  editing,
  onClose,
  onSave,
}: {
  editing?: Goal;
  onClose: () => void;
  onSave: (body: Omit<Goal, "id">, id?: string) => Promise<void>;
}) {
  const [form, setForm] = useState<Omit<Goal, "id">>(
    editing ? { ...editing } : emptyGoal()
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(
      { ...form, target_amount: Number(form.target_amount), manual_current: form.account ? 0 : Number(form.manual_current) },
      editing?.id
    );
    setSaving(false);
  }

  const inputCls =
    "border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            {editing ? "Edit Goal" : "New Goal"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Goal name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Emergency Fund"
              className={inputCls}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Target amount
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.target_amount || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, target_amount: parseFloat(e.target.value) }))
                }
                placeholder="10000"
                className={inputCls}
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-slate-600 mb-1">Currency</label>
              <input
                value={form.currency}
                onChange={(e) =>
                  setForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))
                }
                placeholder="USD"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Linked account <span className="text-slate-400">(optional)</span>
            </label>
            <input
              value={form.account}
              onChange={(e) => setForm((p) => ({ ...p, account: e.target.value }))}
              placeholder="e.g. Assets:Savings"
              className={inputCls}
            />
            <p className="text-xs text-slate-400 mt-1">
              If set, the current amount is read from your ledger automatically.
            </p>
          </div>

          {!form.account && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Current amount
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.manual_current || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, manual_current: parseFloat(e.target.value) }))
                }
                placeholder="0"
                className={inputCls}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-700 border border-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
