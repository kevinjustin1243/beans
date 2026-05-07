import { BEANS_DATA } from "../lib/data";
import { fmtUSD } from "../lib/format";
import { AreaChart, Donut } from "../components/charts";
import { Card, Btn } from "../components/ui";

const COLORS = ["#34d399", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185", "#22d3ee", "#f472b6", "#a3e635"];

export default function InvestmentsPage() {
  const { positions, portfolioSeries } = BEANS_DATA;
  const total    = positions.reduce((s, p) => s + p.shares * p.price, 0);
  const cost     = positions.reduce((s, p) => s + p.shares * p.costBasis, 0);
  const gain     = total - cost;
  const gainPct  = (gain / cost) * 100;

  const slices = positions.map((p, i) => ({
    name: p.ticker,
    value: p.shares * p.price,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="p-7 space-y-6 max-w-[1400px]">
      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-8 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-neutral-500 text-xs uppercase tracking-wider mb-1.5">Portfolio Value</div>
              <div className="flex items-baseline gap-3">
                <div className="text-white text-4xl font-semibold tabular-nums tracking-tight">{fmtUSD(total, { decimals: 0 })}</div>
                <div className={`text-sm tabular-nums font-medium ${gain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {gain >= 0 ? "+" : "−"}{fmtUSD(Math.abs(gain), { decimals: 0 })}
                  <span className="text-neutral-500 ml-1">({gainPct.toFixed(2)}%)</span>
                </div>
              </div>
              <div className="text-neutral-500 text-xs mt-1">all-time return</div>
            </div>
          </div>
          <AreaChart
            series={portfolioSeries}
            color="#34d399"
            height={220}
            formatDate={(d) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })}
          />
        </Card>
        <Card className="col-span-12 lg:col-span-4 p-6">
          <h2 className="text-white text-sm font-semibold mb-4">Allocation</h2>
          <div className="flex justify-center mb-4">
            <Donut slices={slices} size={170} thickness={20} centerLabel="POSITIONS" centerValue={String(positions.length)} />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {slices.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="font-mono text-neutral-200">{s.name}</span>
                <span className="ml-auto text-neutral-500 tabular-nums">{((s.value / total) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-white text-sm font-semibold">Positions</h2>
          <Btn variant="ghost">+ Add position</Btn>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
              <th className="text-left px-5 py-2 font-medium">Ticker</th>
              <th className="text-left py-2 font-medium">Account</th>
              <th className="text-right py-2 font-medium">Shares</th>
              <th className="text-right py-2 font-medium">Cost</th>
              <th className="text-right py-2 font-medium">Price</th>
              <th className="text-right py-2 font-medium">Value</th>
              <th className="text-right px-5 py-2 font-medium">Return</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const value = p.shares * p.price;
              const g     = (p.price - p.costBasis) * p.shares;
              const gp    = ((p.price - p.costBasis) / p.costBasis) * 100;
              return (
                <tr key={p.ticker} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-white">{p.ticker}</span>
                      <span className="text-neutral-500 text-xs truncate max-w-[200px]">{p.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-neutral-400 text-xs font-mono">{p.account.split(":").pop()}</td>
                  <td className="py-3 text-right text-neutral-300 tabular-nums">{p.shares.toFixed(2)}</td>
                  <td className="py-3 text-right text-neutral-500 tabular-nums">{fmtUSD(p.costBasis, { decimals: 2 })}</td>
                  <td className="py-3 text-right text-neutral-200 tabular-nums">{fmtUSD(p.price, { decimals: 2 })}</td>
                  <td className="py-3 text-right text-white font-semibold tabular-nums">{fmtUSD(value, { decimals: 0 })}</td>
                  <td className={`px-5 py-3 text-right tabular-nums font-medium ${g >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    <div>{g >= 0 ? "+" : "−"}{fmtUSD(Math.abs(g), { decimals: 0 })}</div>
                    <div className="text-[11px] opacity-70">{gp >= 0 ? "+" : ""}{gp.toFixed(2)}%</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
