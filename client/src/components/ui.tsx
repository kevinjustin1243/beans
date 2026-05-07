import type { ReactNode } from "react";
import { acctColor, accountType } from "../lib/format";

// ─── Card ──────────────────────────────────────────────────────────────────────

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-neutral-900/60 ring-1 ring-white/5 rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

// ─── Btn ───────────────────────────────────────────────────────────────────────

const BTN_VARIANTS = {
  default: "bg-white/5 hover:bg-white/10 text-neutral-200 ring-1 ring-white/5",
  primary: "bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold shadow-lg shadow-emerald-500/20",
  ghost:   "hover:bg-white/5 text-neutral-400 hover:text-neutral-200",
};

export function Btn({
  children,
  variant = "default",
  onClick,
  className = "",
}: {
  children: ReactNode;
  variant?: "default" | "primary" | "ghost";
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 h-9 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${BTN_VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// ─── AccountBadge ─────────────────────────────────────────────────────────────

export function AccountBadge({ account }: { account: string }) {
  const c = acctColor(account);
  const t = accountType(account);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide ${c.bg} ${c.text}`}>
      <span className={`w-1 h-1 rounded-full ${c.dot}`} />
      {t}
    </span>
  );
}
