import { useState } from "react";
import { BEANS_DATA } from "../lib/data";
import { fmtUSD, acctColor } from "../lib/format";
import { Card, Btn } from "../components/ui";

type FilterType = "all" | "Expenses" | "Income" | "Assets" | "Liabilities";

export default function TransactionsPage() {
  const { transactions } = BEANS_DATA;
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");

  const filtered = transactions.filter((t) => {
    if (search && !(t.payee + " " + t.narration).toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== "all") {
      const has = t.postings.some((p) => p.account.startsWith(filterType + ":"));
      if (!has) return false;
    }
    return true;
  });

  // Group by date
  const byDate: Record<string, typeof transactions> = {};
  filtered.slice(0, 60).forEach((t) => {
    (byDate[t.date] ??= []).push(t);
  });

  const FILTERS: FilterType[] = ["all", "Expenses", "Income", "Assets", "Liabilities"];

  return (
    <div className="p-7 space-y-5 max-w-[1400px]">
      <Card className="p-3 flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg flex-1">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-500 shrink-0">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3-3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by payee or narration…"
            className="bg-transparent outline-none text-sm text-white placeholder:text-neutral-500 flex-1"
          />
        </div>
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-2.5 h-7 text-xs rounded-md transition-colors ${filterType === f ? "bg-white/10 text-white" : "text-neutral-400 hover:text-neutral-200"}`}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>
        <Btn variant="primary">+ New</Btn>
      </Card>

      <Card className="overflow-hidden">
        {Object.entries(byDate).map(([date, txs]) => {
          const dayTotal = txs.reduce((s, t) => {
            const exp = t.postings.find((p) => p.account.startsWith("Expenses:"));
            return s + (exp ? parseFloat(exp.units.number) : 0);
          }, 0);
          return (
            <div key={date}>
              <div className="flex items-center gap-3 px-5 py-2 bg-white/[0.02] border-y border-white/5">
                <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                  {new Date(date).toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })}
                </span>
                <span className="ml-auto text-[11px] text-neutral-500 tabular-nums">
                  {txs.length} entries · {fmtUSD(dayTotal, { decimals: 2 })} spent
                </span>
              </div>
              {txs.map((t) => {
                const exp  = t.postings.find((p) => p.account.startsWith("Expenses:"));
                const inc  = t.postings.find((p) => p.account.startsWith("Income:"));
                const main = exp ?? inc ?? t.postings[0];
                const amount = parseFloat(main.units.number);
                const isInc  = main.account.startsWith("Income:");
                const c      = acctColor(main.account);
                return (
                  <div key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors border-b border-white/[0.03]">
                    <div className={`w-8 h-8 rounded-lg ${c.bg} ring-1 ${c.ring} flex items-center justify-center text-[11px] font-semibold ${c.text}`}>
                      {t.payee.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-200 text-sm font-medium truncate">{t.payee}</span>
                        {t.flag === "!" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">pending</span>
                        )}
                        {t.tags.map((tag) => (
                          <span key={tag} className="text-[10px] text-neutral-500 font-mono">#{tag}</span>
                        ))}
                      </div>
                      <div className="text-neutral-500 text-xs truncate">
                        {t.narration} · <span className="font-mono">{main.account}</span>
                      </div>
                    </div>
                    <div className="hidden md:flex flex-col items-end text-[11px] text-neutral-600 font-mono min-w-[200px]">
                      {t.postings.map((p, i) => {
                        const pc = acctColor(p.account);
                        const n  = parseFloat(p.units.number);
                        return (
                          <div key={i} className="flex gap-3 tabular-nums">
                            <span className={pc.text}>{p.account.split(":").slice(-2).join(":")}</span>
                            <span className="text-neutral-500 w-16 text-right">
                              {n >= 0 ? "+" : "−"}{Math.abs(n).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className={`tabular-nums font-semibold text-sm w-24 text-right ${isInc ? "text-emerald-400" : "text-neutral-100"}`}>
                      {isInc ? "+" : "−"}{fmtUSD(Math.abs(amount), { decimals: 2 })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
