import { useState } from "react";
import { BEANS_DATA } from "../lib/data";
import { fmtUSD, acctColor } from "../lib/format";
import { Sparkline } from "../components/charts";
import { Card, Btn } from "../components/ui";

type FilterType = "all" | "Assets" | "Liabilities" | "Income" | "Expenses";

interface TreeNode {
  name: string;
  type: string;
  balance: number;
  children: Record<string, TreeNode>;
}

export default function AccountsPage() {
  const { accounts, netWorthSeries } = BEANS_DATA;
  const [filter, setFilter] = useState<FilterType>("all");

  // Build hierarchy
  const tree: Record<string, TreeNode> = {};
  Object.entries(accounts).forEach(([name, info]) => {
    const parts = name.split(":");
    let node = tree;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join(":");
      if (!node[part]) node[part] = { name: path, children: {}, balance: 0, type: parts[0] };
      if (i === parts.length - 1 && info.balance !== undefined) node[part].balance = info.balance;
      node = node[part].children;
    });
  });

  function sumNode(n: TreeNode): number {
    let s = n.balance;
    Object.values(n.children).forEach((c) => { s += sumNode(c); });
    return s;
  }

  const assetsTotal = Object.values(accounts).filter((a) => a.type === "Assets").reduce((s, a) => s + (a.balance ?? 0), 0);
  const liabTotal   = Object.values(accounts).filter((a) => a.type === "Liabilities").reduce((s, a) => s + (a.balance ?? 0), 0);
  const netWorth    = assetsTotal + liabTotal;

  function renderNode(n: TreeNode, depth = 0, key = ""): React.ReactNode {
    const total    = sumNode(n);
    const c        = acctColor(n.name);
    const isLeaf   = Object.keys(n.children).length === 0;
    const visible  = filter === "all" || n.type === filter;
    if (!visible && depth === 0) return null;
    const label = n.name.split(":").pop()!;
    return (
      <div key={key}>
        <div
          className={`flex items-center gap-3 py-2.5 hover:bg-white/[0.02] transition-colors ${depth === 0 ? "bg-white/[0.015]" : ""}`}
          style={{ paddingLeft: `${16 + depth * 20}px`, paddingRight: 16 }}
        >
          {depth === 0 && <span className={`w-1 h-4 rounded-full ${c.dot}`} />}
          <span className={`flex-1 text-sm ${depth === 0 ? "font-semibold text-white" : isLeaf ? "text-neutral-400" : "font-medium text-neutral-300"}`}>
            {label}
          </span>
          {depth === 0 && <span className="text-[10px] text-neutral-600 mr-3">{Object.keys(n.children).length} sub</span>}
          <span className={`tabular-nums text-sm ${depth === 0 ? "font-semibold text-white" : "text-neutral-400"}`}>
            {total === 0 ? "—" : fmtUSD(Math.abs(total), { decimals: 2 })}
          </span>
        </div>
        {Object.values(n.children).map((child, i) => renderNode(child, depth + 1, `${key}:${i}`))}
      </div>
    );
  }

  const FILTER_TYPES: FilterType[] = ["all", "Assets", "Liabilities", "Income", "Expenses"];

  return (
    <div className="p-7 space-y-6 max-w-[1400px]">
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium mb-2">Total Assets</div>
          <div className="text-white text-2xl font-semibold tabular-nums">{fmtUSD(assetsTotal, { decimals: 0 })}</div>
          <Sparkline data={netWorthSeries.slice(-30).map((s) => s.value)} color="#34d399" width={200} height={28} />
        </Card>
        <Card className="p-5">
          <div className="text-[10px] uppercase tracking-wider text-rose-400 font-medium mb-2">Total Liabilities</div>
          <div className="text-white text-2xl font-semibold tabular-nums">{fmtUSD(Math.abs(liabTotal), { decimals: 0 })}</div>
          <Sparkline data={[15500, 15200, 15100, 14990, 14946]} color="#fb7185" width={200} height={28} fill={false} />
        </Card>
        <Card className="p-5 bg-emerald-500/[0.04] ring-emerald-500/20">
          <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium mb-2">Net Worth</div>
          <div className="text-white text-2xl font-semibold tabular-nums">{fmtUSD(netWorth, { decimals: 0 })}</div>
          <div className="text-emerald-400 text-xs tabular-nums">+{fmtUSD(5840, { decimals: 0 })} this month</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-white/5">
          {FILTER_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 h-8 rounded-lg text-xs font-medium transition-colors ${filter === t ? "bg-white/10 text-white" : "text-neutral-400 hover:text-neutral-200"}`}
            >
              {t === "all" ? "All accounts" : t}
            </button>
          ))}
          <div className="ml-auto"><Btn variant="primary">+ Opening Balance</Btn></div>
        </div>
        <div className="divide-y divide-white/5">
          {Object.values(tree).map((n, i) => renderNode(n, 0, String(i)))}
        </div>
      </Card>
    </div>
  );
}
