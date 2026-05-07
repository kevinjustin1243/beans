import type { ReactNode } from "react";
import { fmtUSD } from "../lib/format";

type PageId = "dashboard" | "accounts" | "transactions" | "budget" | "goals" | "investments" | "ledger";

// ─── NavIcon ──────────────────────────────────────────────────────────────────

const ICON_PROPS = { width: 16, height: 16, fill: "none" as const, stroke: "currentColor" as const, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function NavIcon({ name }: { name: string }) {
  switch (name) {
    case "home":   return <svg viewBox="0 0 24 24" {...ICON_PROPS}><path d="M3 12l9-9 9 9" /><path d="M5 10v10h14V10" /></svg>;
    case "wallet": return <svg viewBox="0 0 24 24" {...ICON_PROPS}><path d="M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /><path d="M3 7l3-4h12l3 4" /><circle cx="17" cy="14" r="1.2" fill="currentColor" /></svg>;
    case "list":   return <svg viewBox="0 0 24 24" {...ICON_PROPS}><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" /></svg>;
    case "pie":    return <svg viewBox="0 0 24 24" {...ICON_PROPS}><path d="M12 3v9h9" /><path d="M21 12a9 9 0 1 1-9-9" /></svg>;
    case "flag":   return <svg viewBox="0 0 24 24" {...ICON_PROPS}><path d="M5 21V4" /><path d="M5 4h12l-2 4 2 4H5" /></svg>;
    case "trend":  return <svg viewBox="0 0 24 24" {...ICON_PROPS}><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>;
    case "book":   return <svg viewBox="0 0 24 24" {...ICON_PROPS}><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z" /><path d="M4 17a3 3 0 0 1 3-3h12" /></svg>;
    default:       return null;
  }
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: PageId; label: string; icon: string }[] = [
  { id: "dashboard",    label: "Dashboard",    icon: "home"   },
  { id: "accounts",     label: "Accounts",     icon: "wallet" },
  { id: "transactions", label: "Transactions", icon: "list"   },
  { id: "budget",       label: "Budget",       icon: "pie"    },
  { id: "goals",        label: "Goals",        icon: "flag"   },
  { id: "investments",  label: "Investments",  icon: "trend"  },
  { id: "ledger",       label: "Ledger",       icon: "book"   },
];

export function Sidebar({
  current,
  onNavigate,
  collapsed,
  onToggle,
}: {
  current: PageId;
  onNavigate: (p: PageId) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside className={`shrink-0 flex flex-col bg-neutral-950 border-r border-white/5 transition-all duration-300 ${collapsed ? "w-[68px]" : "w-[228px]"}`}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
            <path d="M8 4c0 4-4 5-4 9a4 4 0 0 0 8 0c0-4-4-5-4-9z" />
            <path d="M16 7c0 3-3 4-3 7a3 3 0 0 0 6 0c0-3-3-4-3-7z" />
          </svg>
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-[15px] tracking-tight">beans</div>
            <div className="text-neutral-500 text-[10px] tracking-wider uppercase">double-entry money</div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5">
        {NAV_ITEMS.map((n) => {
          const active = current === n.id;
          return (
            <button
              key={n.id}
              onClick={() => onNavigate(n.id)}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all group ${
                active ? "bg-white/[0.06] text-white" : "text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200"
              }`}
            >
              <span className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                active ? "bg-emerald-500/15 text-emerald-400" : "text-neutral-500 group-hover:text-neutral-300"
              }`}>
                <NavIcon name={n.icon} />
              </span>
              {!collapsed && <span className="font-medium">{n.label}</span>}
              {!collapsed && active && <span className="ml-auto w-1 h-1 rounded-full bg-emerald-400" />}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2.5 py-3 border-t border-white/5 space-y-0.5">
        {!collapsed && (
          <div className="px-2.5 py-2 rounded-lg bg-emerald-500/[0.06] ring-1 ring-emerald-500/10 mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium">Net Worth</span>
            </div>
            <div className="text-white font-semibold tabular-nums">{fmtUSD(238421, { compact: true, decimals: 1 })}</div>
            <div className="text-[11px] text-emerald-400 tabular-nums">+2.4% this month</div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm text-neutral-500 hover:bg-white/[0.03] hover:text-neutral-300 transition-colors"
        >
          <span className="shrink-0 w-7 h-7 flex items-center justify-center">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
            </svg>
          </span>
          {!collapsed && <span>Collapse</span>}
        </button>
        <button className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm text-neutral-500 hover:bg-white/[0.03] hover:text-neutral-300 transition-colors">
          <span className="shrink-0 w-7 h-7 rounded-md bg-neutral-800 flex items-center justify-center text-[11px] font-semibold text-neutral-300">KJ</span>
          {!collapsed && (
            <div className="flex-1 min-w-0 text-left">
              <div className="text-neutral-300 text-[13px] truncate">kevin</div>
              <div className="text-neutral-600 text-[10px]">Sign out</div>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

export function TopBar({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="h-16 px-7 flex items-center border-b border-white/5 bg-neutral-950/40 backdrop-blur sticky top-0 z-10">
      <div className="flex-1 min-w-0">
        <h1 className="text-white text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="text-neutral-500 text-xs">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
