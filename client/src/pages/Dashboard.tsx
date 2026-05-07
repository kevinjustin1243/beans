import { useState } from "react";
import { BEANS_DATA } from "../lib/data";
import { fmtUSD, acctColor } from "../lib/format";
import { Sparkline, AreaChart, Donut, Progress } from "../components/charts";
import { Card, Btn } from "../components/ui";

const RANGES = { "7D": 7, "30D": 30, "90D": 90 } as const;
type Range = keyof typeof RANGES;

export default function DashboardPage() {
  const { netWorthSeries, transactions, accounts, goals, positions } = BEANS_DATA;
  const [range, setRange] = useState<Range>("90D");

  const slice = netWorthSeries.slice(-RANGES[range]);
  const startVal = slice[0].value;
  const endVal = slice[slice.length - 1].value;
  const change = endVal - startVal;
  const pct = (change / startVal) * 100;

  const assetsTotal = Object.values(accounts).filter((a) => a.type === "Assets").reduce((s, a) => s + (a.balance ?? 0), 0);
  const liabTotal   = Object.values(accounts).filter((a) => a.type === "Liabilities").reduce((s, a) => s + (a.balance ?? 0), 0);

  // This month spending by top-level expense category
  const monthAgo = new Date(2026, 4, 7);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const monthAgoStr = monthAgo.toISOString().slice(0, 10);
  const catSpend: Record<string, number> = {};
  transactions.filter((t) => t.date >= monthAgoStr).forEach((t) => {
    t.postings.forEach((p) => {
      if (p.account.startsWith("Expenses:")) {
        const cat = p.account.split(":")[1];
        catSpend[cat] = (catSpend[cat] ?? 0) + parseFloat(p.units.number);
      }
    });
  });
  const totalSpent = Object.values(catSpend).reduce((s, v) => s + v, 0);
  const catColors = ["#34d399", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185", "#22d3ee"];
  const catSlices = Object.entries(catSpend)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: catColors[i % catColors.length] }));

  const portfolioValue = positions.reduce((s, p) => s + p.shares * p.price, 0);
  const portfolioCost  = positions.reduce((s, p) => s + p.shares * p.costBasis, 0);
  const portfolioGain  = portfolioValue - portfolioCost;

  const recentTx = transactions.filter((t) => {
    const cutoff = new Date(2026, 4, 7);
    cutoff.setDate(cutoff.getDate() - 7);
    return new Date(t.date) >= cutoff;
  });

  return (
    <div className="p-7 space-y-6 max-w-[1400px]">
      {/* Hero row */}
      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-8 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-neutral-500 text-xs uppercase tracking-wider mb-1.5">Net Worth</div>
              <div className="flex items-baseline gap-3">
                <div className="text-white text-4xl font-semibold tabular-nums tracking-tight">{fmtUSD(endVal, { decimals: 0 })}</div>
                <div className={`text-sm tabular-nums font-medium flex items-center gap-1 ${change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  <span>{change >= 0 ? "↑" : "↓"}</span>
                  {fmtUSD(Math.abs(change), { decimals: 0 })}
                  <span className="text-neutral-500">({pct.toFixed(2)}%)</span>
                </div>
              </div>
              <div className="text-neutral-500 text-xs mt-1">past {range.toLowerCase()}</div>
            </div>
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
              {(Object.keys(RANGES) as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2.5 h-7 text-xs rounded-md transition-colors ${range === r ? "bg-emerald-500 text-emerald-950 font-semibold" : "text-neutral-400 hover:text-neutral-200"}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <AreaChart
            series={slice}
            color="#34d399"
            height={220}
            formatDate={(d) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })}
          />
        </Card>

        <div className="col-span-12 lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-5">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium">Assets</span>
              <Sparkline data={slice.map((s) => s.value * 1.4)} color="#34d399" width={60} height={20} />
            </div>
            <div className="text-white text-2xl font-semibold tabular-nums">{fmtUSD(assetsTotal, { compact: true, decimals: 1 })}</div>
            <div className="text-neutral-500 text-xs mt-1">across 7 accounts</div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-rose-400 font-medium">Liabilities</span>
              <Sparkline data={[15500, 15300, 15100, 14900, 14946].map((v) => -v)} color="#fb7185" width={60} height={20} />
            </div>
            <div className="text-white text-2xl font-semibold tabular-nums">{fmtUSD(Math.abs(liabTotal), { compact: true, decimals: 1 })}</div>
            <div className="text-neutral-500 text-xs mt-1">3 accounts</div>
          </Card>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 md:col-span-7 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-white text-base font-semibold">Recent Transactions</h2>
              <div className="text-neutral-500 text-xs">last 7 days · {recentTx.length} entries</div>
            </div>
            <Btn variant="ghost">View all →</Btn>
          </div>
          <div className="space-y-1">
            {transactions.slice(0, 6).map((t) => {
              const expense = t.postings.find((p) => p.account.startsWith("Expenses:"));
              const income  = t.postings.find((p) => p.account.startsWith("Income:"));
              const main    = expense ?? income ?? t.postings[0];
              const amount  = parseFloat(main.units.number);
              const isIncome = main.account.startsWith("Income:");
              const c = acctColor(main.account);
              return (
                <div key={t.id} className="flex items-center gap-3 px-2 py-2.5 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors group">
                  <div className={`w-9 h-9 rounded-lg ${c.bg} ring-1 ${c.ring} flex items-center justify-center text-xs font-semibold ${c.text}`}>
                    {t.payee.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-neutral-200 text-sm font-medium truncate">{t.payee}</div>
                    <div className="text-neutral-500 text-xs truncate">{main.account.split(":").slice(1).join(" · ")}</div>
                  </div>
                  <div className="text-right">
                    <div className={`tabular-nums font-medium text-sm ${isIncome ? "text-emerald-400" : "text-neutral-200"}`}>
                      {isIncome ? "+" : "−"}{fmtUSD(Math.abs(amount), { decimals: 2 })}
                    </div>
                    <div className="text-neutral-600 text-xs">{t.date.slice(5)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="col-span-12 md:col-span-5 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-white text-base font-semibold">Spending</h2>
              <div className="text-neutral-500 text-xs">last 30 days</div>
            </div>
            <span className="text-[11px] text-neutral-400 px-2 py-1 rounded-md bg-white/5 tabular-nums">{fmtUSD(totalSpent, { decimals: 0 })}</span>
          </div>
          <div className="flex items-center gap-6">
            <Donut
              slices={catSlices}
              size={160}
              thickness={20}
              centerLabel="TOTAL"
              centerValue={fmtUSD(totalSpent, { compact: true, decimals: 1 })}
            />
            <div className="flex-1 space-y-2">
              {catSlices.slice(0, 6).map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 text-neutral-300 truncate">{s.name}</span>
                  <span className="text-neutral-500 tabular-nums text-xs">{fmtUSD(s.value, { decimals: 0 })}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Row 3 — goals + portfolio */}
      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 md:col-span-7 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white text-base font-semibold">Goals</h2>
            <Btn variant="ghost">Manage →</Btn>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {goals.map((g) => {
              const gpct = (g.current / g.target) * 100;
              const colorMap: Record<string, string> = { emerald: "bg-emerald-400", sky: "bg-sky-400", violet: "bg-violet-400", amber: "bg-amber-400" };
              return (
                <div key={g.id} className="p-4 rounded-xl bg-white/[0.02] ring-1 ring-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-neutral-300 text-sm font-medium">{g.name}</div>
                    <div className="text-neutral-500 text-xs tabular-nums">{gpct.toFixed(0)}%</div>
                  </div>
                  <Progress value={g.current} max={g.target} color={colorMap[g.color]} />
                  <div className="flex items-baseline justify-between mt-2.5 tabular-nums">
                    <span className="text-white text-sm font-semibold">{fmtUSD(g.current, { compact: true, decimals: 1 })}</span>
                    <span className="text-neutral-500 text-xs">of {fmtUSD(g.target, { compact: true, decimals: 0 })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="col-span-12 md:col-span-5 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white text-base font-semibold">Portfolio</h2>
              <div className="text-neutral-500 text-xs">8 positions across 3 accounts</div>
            </div>
          </div>
          <div className="flex items-baseline gap-3 mb-3">
            <div className="text-white text-2xl font-semibold tabular-nums">{fmtUSD(portfolioValue, { decimals: 0 })}</div>
            <div className={`text-sm tabular-nums font-medium ${portfolioGain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {portfolioGain >= 0 ? "+" : "−"}{fmtUSD(Math.abs(portfolioGain), { decimals: 0 })}
            </div>
          </div>
          <Sparkline data={BEANS_DATA.portfolioSeries.map((s) => s.value)} color="#34d399" width={420} height={50} />
          <div className="space-y-1.5 mt-4">
            {positions.slice(0, 4).map((p) => {
              const value = p.shares * p.price;
              const gain  = (p.price - p.costBasis) * p.shares;
              const gpct  = ((p.price - p.costBasis) / p.costBasis) * 100;
              return (
                <div key={p.ticker} className="flex items-center justify-between text-sm py-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[11px] font-semibold text-neutral-200 w-12">{p.ticker}</span>
                    <span className="text-neutral-500 text-xs truncate max-w-[160px]">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-neutral-300 text-xs">{fmtUSD(value, { compact: true, decimals: 1 })}</span>
                    <span className={`text-xs w-14 text-right ${gain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {gain >= 0 ? "+" : ""}{gpct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
