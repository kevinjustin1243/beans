import { BEANS_DATA } from "../lib/data";
import { fmtUSD } from "../lib/format";
import { Card, Btn } from "../components/ui";

const TARGETS: Record<string, number> = {
  "Expenses:Food:Groceries":          600,
  "Expenses:Food:Restaurants":        400,
  "Expenses:Food:Coffee":             100,
  "Expenses:Housing:Rent":           2400,
  "Expenses:Housing:Utilities":       120,
  "Expenses:Housing:Internet":         80,
  "Expenses:Transport:Gas":           200,
  "Expenses:Transport:Transit":        80,
  "Expenses:Transport:Rideshare":     150,
  "Expenses:Entertainment:Streaming":  50,
  "Expenses:Entertainment:Concerts":  100,
  "Expenses:Shopping:Clothing":       150,
  "Expenses:Shopping:Home":           200,
  "Expenses:Health:Gym":              220,
  "Expenses:Health:Pharmacy":          50,
  "Expenses:Travel":                  500,
};

export default function BudgetPage() {
  const { transactions } = BEANS_DATA;

  const monthAgo = new Date(2026, 4, 7);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const monthAgoStr = monthAgo.toISOString().slice(0, 10);

  const spend: Record<string, number> = {};
  transactions.filter((t) => t.date >= monthAgoStr).forEach((t) => {
    t.postings.forEach((p) => {
      if (p.account.startsWith("Expenses:")) {
        spend[p.account] = (spend[p.account] ?? 0) + parseFloat(p.units.number);
      }
    });
  });

  const income = transactions.filter((t) => t.date >= monthAgoStr).reduce((s, t) => {
    const inc = t.postings.find((p) => p.account.startsWith("Income:Salary"));
    return s + (inc ? parseFloat(inc.units.number) : 0);
  }, 0);

  const totalSpent  = Object.values(spend).reduce((s, v) => s + v, 0);
  const totalBudget = Object.values(TARGETS).reduce((s, v) => s + v, 0);
  const available   = income - totalSpent;

  // Group by top-level category
  const groups: Record<string, { acct: string; target: number; spent: number }[]> = {};
  Object.entries(TARGETS).forEach(([acct, target]) => {
    const cat = acct.split(":")[1];
    (groups[cat] ??= []).push({ acct, target, spent: spend[acct] ?? 0 });
  });

  return (
    <div className="p-7 space-y-6 max-w-[1400px]">
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-[10px] uppercase tracking-wider text-sky-400 font-medium mb-2">Income</div>
          <div className="text-white text-2xl font-semibold tabular-nums">{fmtUSD(income, { decimals: 0 })}</div>
        </Card>
        <Card className="p-5">
          <div className="text-[10px] uppercase tracking-wider text-amber-400 font-medium mb-2">Spent</div>
          <div className="text-white text-2xl font-semibold tabular-nums">{fmtUSD(totalSpent, { decimals: 0 })}</div>
          <div className="text-neutral-500 text-xs">of {fmtUSD(totalBudget, { decimals: 0 })} budget</div>
        </Card>
        <Card className="p-5 bg-emerald-500/[0.04] ring-emerald-500/20">
          <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium mb-2">Available</div>
          <div className={`text-2xl font-semibold tabular-nums ${available >= 0 ? "text-white" : "text-rose-400"}`}>
            {fmtUSD(available, { decimals: 0 })}
          </div>
          <div className="text-neutral-500 text-xs">{((available / income) * 100).toFixed(0)}% of income</div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white text-base font-semibold">Spending by Category</h2>
            <div className="text-neutral-500 text-xs">May 7, 2026 · last 30 days</div>
          </div>
          <Btn>+ Set target</Btn>
        </div>
        <div className="space-y-6">
          {Object.entries(groups).map(([cat, items]) => {
            const catSpent  = items.reduce((s, i) => s + i.spent, 0);
            const catTarget = items.reduce((s, i) => s + i.target, 0);
            const pct       = (catSpent / catTarget) * 100;
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-neutral-200 text-sm font-semibold">{cat}</span>
                  <div className="flex items-center gap-3 tabular-nums text-xs">
                    <span className={pct > 100 ? "text-rose-400" : pct > 80 ? "text-amber-400" : "text-emerald-400"}>
                      {pct.toFixed(0)}%
                    </span>
                    <span className="text-neutral-300">{fmtUSD(catSpent, { decimals: 0 })}</span>
                    <span className="text-neutral-500">/ {fmtUSD(catTarget, { decimals: 0 })}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {items.map((item) => {
                    const p    = (item.spent / item.target) * 100;
                    const over = item.spent > item.target;
                    const barColor = over ? "bg-rose-400" : p > 80 ? "bg-amber-400" : "bg-emerald-400";
                    return (
                      <div key={item.acct} className="flex items-center gap-4">
                        <span className="text-xs text-neutral-400 w-32 truncate">{item.acct.split(":").pop()}</span>
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${barColor} rounded-full transition-all duration-700`}
                            style={{ width: `${Math.min(p, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-neutral-300 w-20 text-right">{fmtUSD(item.spent, { decimals: 0 })}</span>
                        <span className="text-xs tabular-nums text-neutral-600 w-20 text-right">/ {fmtUSD(item.target, { decimals: 0 })}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
