// Formatting helpers and account color map

export function fmtUSD(n: number, opts: { compact?: boolean; signed?: boolean; decimals?: number } = {}): string {
  const { compact, signed, decimals = 2 } = opts;
  const abs = Math.abs(n);
  if (compact && abs >= 1000) {
    if (abs >= 1_000_000) return `${signed && n > 0 ? "+" : ""}$${(n / 1_000_000).toFixed(2)}M`;
    return `${signed && n > 0 ? "+" : ""}$${(n / 1000).toFixed(1)}k`;
  }
  const s = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(n));
  return n < 0 ? `−${s}` : signed && n > 0 ? `+${s}` : s;
}

export const ACCOUNT_COLORS: Record<string, { bg: string; text: string; dot: string; ring: string; hex: string }> = {
  Assets:      { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400", ring: "ring-emerald-500/30", hex: "#34d399" },
  Liabilities: { bg: "bg-rose-500/10",    text: "text-rose-400",    dot: "bg-rose-400",    ring: "ring-rose-500/30",    hex: "#fb7185" },
  Income:      { bg: "bg-sky-500/10",     text: "text-sky-400",     dot: "bg-sky-400",     ring: "ring-sky-500/30",     hex: "#38bdf8" },
  Expenses:    { bg: "bg-amber-500/10",   text: "text-amber-400",   dot: "bg-amber-400",   ring: "ring-amber-500/30",   hex: "#fbbf24" },
  Equity:      { bg: "bg-violet-500/10",  text: "text-violet-400",  dot: "bg-violet-400",  ring: "ring-violet-500/30",  hex: "#a78bfa" },
};

export function accountType(name: string): string {
  return name.split(":")[0];
}

export function acctColor(name: string) {
  return ACCOUNT_COLORS[accountType(name)] ?? ACCOUNT_COLORS.Equity;
}
