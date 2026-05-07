import { BEANS_DATA } from "../lib/data";
import { fmtUSD } from "../lib/format";
import { Progress } from "../components/charts";
import { Card } from "../components/ui";

const COLOR_MAP = {
  emerald: { bar: "bg-emerald-400", glow: "from-emerald-500/20", text: "text-emerald-400" },
  sky:     { bar: "bg-sky-400",     glow: "from-sky-500/20",     text: "text-sky-400"     },
  violet:  { bar: "bg-violet-400",  glow: "from-violet-500/20",  text: "text-violet-400"  },
  amber:   { bar: "bg-amber-400",   glow: "from-amber-500/20",   text: "text-amber-400"   },
} as const;

export default function GoalsPage() {
  const { goals } = BEANS_DATA;
  const totalTarget  = goals.reduce((s, g) => s + g.target, 0);
  const totalCurrent = goals.reduce((s, g) => s + g.current, 0);

  return (
    <div className="p-7 space-y-6 max-w-[1400px]">
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5 col-span-2 bg-gradient-to-br from-emerald-500/[0.06] to-transparent ring-emerald-500/15">
          <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium mb-2">Saving Toward</div>
          <div className="flex items-baseline gap-3">
            <div className="text-white text-3xl font-semibold tabular-nums">{fmtUSD(totalCurrent, { decimals: 0 })}</div>
            <div className="text-neutral-500 text-sm">/ {fmtUSD(totalTarget, { decimals: 0 })} across {goals.length} goals</div>
          </div>
          <div className="mt-3">
            <Progress value={totalCurrent} max={totalTarget} color="bg-emerald-400" height="h-2" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-2">Avg Monthly Save</div>
          <div className="text-white text-2xl font-semibold tabular-nums">{fmtUSD(1850, { decimals: 0 })}</div>
          <div className="text-emerald-400 text-xs">on track for all goals</div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {goals.map((g) => {
          const pct       = (g.current / g.target) * 100;
          const remaining = g.target - g.current;
          const c         = COLOR_MAP[g.color];
          const due       = new Date(g.due);
          const monthsLeft = Math.max(1, Math.round((due.getTime() - new Date(2026, 4, 7).getTime()) / (1000 * 60 * 60 * 24 * 30)));
          const monthlyNeeded = remaining / monthsLeft;
          return (
            <Card key={g.id} className={`p-6 relative overflow-hidden bg-gradient-to-br ${c.glow} to-transparent`}>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="text-white text-lg font-semibold">{g.name}</div>
                  <div className="text-neutral-500 text-xs mt-0.5 font-mono">{g.account}</div>
                </div>
                <div className={`text-3xl font-semibold tabular-nums ${c.text}`}>{pct.toFixed(0)}%</div>
              </div>
              <div className="mb-3">
                <Progress value={g.current} max={g.target} color={c.bar} height="h-2" />
              </div>
              <div className="flex items-baseline justify-between mb-5 tabular-nums">
                <span className="text-white text-xl font-semibold">{fmtUSD(g.current, { decimals: 0 })}</span>
                <span className="text-neutral-500 text-sm">of {fmtUSD(g.target, { decimals: 0 })}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/5">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Remaining</div>
                  <div className="text-neutral-200 tabular-nums text-sm font-medium">{fmtUSD(remaining, { decimals: 0 })}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Monthly</div>
                  <div className="text-neutral-200 tabular-nums text-sm font-medium">{fmtUSD(monthlyNeeded, { decimals: 0 })}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Due</div>
                  <div className="text-neutral-200 tabular-nums text-sm font-medium">
                    {due.toLocaleDateString("en", { month: "short", year: "2-digit" })}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        <Card className="p-6 ring-0 border-2 border-dashed border-white/10 flex items-center justify-center min-h-[280px] hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-all cursor-pointer">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3 text-neutral-400 text-2xl">+</div>
            <div className="text-neutral-300 font-medium">Add a goal</div>
            <div className="text-neutral-500 text-xs mt-1">Track savings toward something</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
