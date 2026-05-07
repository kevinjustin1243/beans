// Mock beancount-style data for Beans

export interface Account {
  type: "Assets" | "Liabilities" | "Income" | "Expenses" | "Equity";
  balance?: number;
  open?: string;
}

export interface Posting {
  account: string;
  units: { number: string; currency: string };
}

export interface Transaction {
  id: string;
  date: string;
  flag: "*" | "!";
  payee: string;
  narration: string;
  tags: string[];
  postings: Posting[];
}

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  account: string;
  due: string;
  color: "emerald" | "sky" | "violet" | "amber";
}

export interface Position {
  ticker: string;
  name: string;
  shares: number;
  costBasis: number;
  price: number;
  account: string;
}

export interface BeansData {
  accounts: Record<string, Account>;
  transactions: Transaction[];
  netWorthSeries: SeriesPoint[];
  goals: Goal[];
  positions: Position[];
  portfolioSeries: SeriesPoint[];
}

// Seeded RNG for deterministic data
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

function buildData(): BeansData {
  const rand = seededRand(42);

  const accounts: Record<string, Account> = {
    "Assets:Bank:Checking":          { type: "Assets",      balance: 8412.55,   open: "2023-01-15" },
    "Assets:Bank:Savings":           { type: "Assets",      balance: 24850.00,  open: "2023-01-15" },
    "Assets:Bank:HYSA":              { type: "Assets",      balance: 18200.00,  open: "2024-03-01" },
    "Assets:Cash":                   { type: "Assets",      balance: 240.00,    open: "2023-01-15" },
    "Assets:Investments:Brokerage":  { type: "Assets",      balance: 67342.18,  open: "2023-04-10" },
    "Assets:Investments:401k":       { type: "Assets",      balance: 102450.00, open: "2022-06-01" },
    "Assets:Investments:Roth":       { type: "Assets",      balance: 31280.50,  open: "2023-04-10" },
    "Liabilities:CreditCard:Chase":  { type: "Liabilities", balance: -1842.30,  open: "2023-02-01" },
    "Liabilities:CreditCard:Amex":   { type: "Liabilities", balance: -624.18,   open: "2023-02-01" },
    "Liabilities:Loan:Student":      { type: "Liabilities", balance: -12480.00, open: "2022-09-01" },
    "Income:Salary:Acme":            { type: "Income" },
    "Income:Interest":               { type: "Income" },
    "Income:Dividends":              { type: "Income" },
    "Expenses:Food:Groceries":       { type: "Expenses" },
    "Expenses:Food:Restaurants":     { type: "Expenses" },
    "Expenses:Food:Coffee":          { type: "Expenses" },
    "Expenses:Housing:Rent":         { type: "Expenses" },
    "Expenses:Housing:Utilities":    { type: "Expenses" },
    "Expenses:Housing:Internet":     { type: "Expenses" },
    "Expenses:Transport:Gas":        { type: "Expenses" },
    "Expenses:Transport:Transit":    { type: "Expenses" },
    "Expenses:Transport:Rideshare":  { type: "Expenses" },
    "Expenses:Entertainment:Streaming": { type: "Expenses" },
    "Expenses:Entertainment:Concerts":  { type: "Expenses" },
    "Expenses:Shopping:Clothing":    { type: "Expenses" },
    "Expenses:Shopping:Home":        { type: "Expenses" },
    "Expenses:Health:Gym":           { type: "Expenses" },
    "Expenses:Health:Pharmacy":      { type: "Expenses" },
    "Expenses:Travel":               { type: "Expenses" },
    "Equity:Opening-Balances":       { type: "Equity" },
  };

  const txTemplates = [
    { payee: "Whole Foods",     narration: "Groceries",         postings: [["Expenses:Food:Groceries", 87.42], ["Liabilities:CreditCard:Chase", -87.42]],           tags: ["food"] },
    { payee: "Trader Joe's",    narration: "Groceries",         postings: [["Expenses:Food:Groceries", 54.18], ["Liabilities:CreditCard:Chase", -54.18]],           tags: ["food"] },
    { payee: "Blue Bottle",     narration: "Coffee",            postings: [["Expenses:Food:Coffee", 5.25], ["Assets:Cash", -5.25]],                                 tags: [] },
    { payee: "Sightglass",      narration: "Latte",             postings: [["Expenses:Food:Coffee", 6.50], ["Liabilities:CreditCard:Amex", -6.50]],                 tags: [] },
    { payee: "Tartine",         narration: "Brunch with Maya",  postings: [["Expenses:Food:Restaurants", 42.80], ["Liabilities:CreditCard:Amex", -42.80]],          tags: ["social"] },
    { payee: "Mission Chinese", narration: "Dinner",            postings: [["Expenses:Food:Restaurants", 78.20], ["Liabilities:CreditCard:Chase", -78.20]],         tags: [] },
    { payee: "Acme Corp",       narration: "Paycheck",          postings: [["Assets:Bank:Checking", 4250.00], ["Income:Salary:Acme", -4250.00]],                    tags: ["payroll"] },
    { payee: "Landlord LLC",    narration: "Rent",              postings: [["Expenses:Housing:Rent", 2400.00], ["Assets:Bank:Checking", -2400.00]],                  tags: [] },
    { payee: "PG&E",            narration: "Electric bill",     postings: [["Expenses:Housing:Utilities", 84.32], ["Assets:Bank:Checking", -84.32]],                tags: [] },
    { payee: "Comcast",         narration: "Internet",          postings: [["Expenses:Housing:Internet", 79.99], ["Assets:Bank:Checking", -79.99]],                 tags: [] },
    { payee: "Shell",           narration: "Gas",               postings: [["Expenses:Transport:Gas", 48.20], ["Liabilities:CreditCard:Chase", -48.20]],            tags: [] },
    { payee: "BART",            narration: "Transit reload",    postings: [["Expenses:Transport:Transit", 40.00], ["Assets:Bank:Checking", -40.00]],                tags: [] },
    { payee: "Lyft",            narration: "Ride home",         postings: [["Expenses:Transport:Rideshare", 18.40], ["Liabilities:CreditCard:Amex", -18.40]],       tags: [] },
    { payee: "Netflix",         narration: "Subscription",      postings: [["Expenses:Entertainment:Streaming", 15.99], ["Liabilities:CreditCard:Chase", -15.99]], tags: ["recurring"] },
    { payee: "Spotify",         narration: "Family plan",       postings: [["Expenses:Entertainment:Streaming", 16.99], ["Liabilities:CreditCard:Chase", -16.99]], tags: ["recurring"] },
    { payee: "Noise Pop",       narration: "Concert tickets",   postings: [["Expenses:Entertainment:Concerts", 88.00], ["Liabilities:CreditCard:Amex", -88.00]],   tags: ["fun"] },
    { payee: "Uniqlo",          narration: "Sweater",           postings: [["Expenses:Shopping:Clothing", 49.90], ["Liabilities:CreditCard:Chase", -49.90]],        tags: [] },
    { payee: "IKEA",            narration: "Lamp + rug",        postings: [["Expenses:Shopping:Home", 184.50], ["Liabilities:CreditCard:Chase", -184.50]],          tags: [] },
    { payee: "Equinox",         narration: "Membership",        postings: [["Expenses:Health:Gym", 215.00], ["Assets:Bank:Checking", -215.00]],                     tags: ["recurring"] },
    { payee: "Walgreens",       narration: "Pharmacy",          postings: [["Expenses:Health:Pharmacy", 22.18], ["Liabilities:CreditCard:Amex", -22.18]],           tags: [] },
    { payee: "Delta",           narration: "Flight to NYC",     postings: [["Expenses:Travel", 412.30], ["Liabilities:CreditCard:Amex", -412.30]],                  tags: ["travel"] },
    { payee: "Ally Bank",       narration: "Interest",          postings: [["Assets:Bank:HYSA", 32.18], ["Income:Interest", -32.18]],                               tags: [] },
    { payee: "Vanguard",        narration: "VTI dividend",      postings: [["Assets:Investments:Brokerage", 124.50], ["Income:Dividends", -124.50]],                tags: ["dividend"] },
  ] as const;

  function build(idx: number, date: string): Transaction {
    const t = txTemplates[idx];
    return {
      id: String(1000 + transactions.length),
      date,
      flag: rand() < 0.05 ? "!" : "*",
      payee: t.payee,
      narration: t.narration,
      tags: [...t.tags],
      postings: t.postings.map(([account, amount]) => ({
        account: account as string,
        units: { number: (amount as number).toFixed(2), currency: "USD" },
      })),
    };
  }

  const transactions: Transaction[] = [];
  const now = new Date(2026, 4, 7); // May 7, 2026

  for (let d = 0; d < 90; d++) {
    const date = new Date(now);
    date.setDate(now.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    const dayOfMonth = date.getDate();

    if (dayOfMonth === 1) { transactions.push(build(7, dateStr)); transactions.push(build(18, dateStr)); }
    if (dayOfMonth === 15 || dayOfMonth === 30) transactions.push(build(6, dateStr));
    if (dayOfMonth === 5)  transactions.push(build(8, dateStr));
    if (dayOfMonth === 12) transactions.push(build(9, dateStr));
    if (dayOfMonth === 20) transactions.push(build(13, dateStr));
    if (dayOfMonth === 22) transactions.push(build(14, dateStr));
    if (dayOfMonth === 28) transactions.push(build(21, dateStr));

    const count = Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      transactions.push(build(Math.floor(rand() * 6), dateStr));
    }
    if (d % 7 === 3)  transactions.push(build(10, dateStr));
    if (d % 11 === 2) transactions.push(build(15, dateStr));
    if (d % 14 === 5) transactions.push(build(20, dateStr));
  }

  transactions.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  // Net worth time series
  const netWorthSeries: SeriesPoint[] = [];
  let nw = 220000;
  for (let d = 89; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(now.getDate() - d);
    nw += (rand() - 0.4) * 400 + 80;
    netWorthSeries.push({ date: date.toISOString().slice(0, 10), value: Math.round(nw) });
  }

  const goals: Goal[] = [
    { id: "g1", name: "Emergency Fund",     target: 30000, current: 24850, account: "Assets:Bank:Savings", due: "2026-12-31", color: "emerald" },
    { id: "g2", name: "Tokyo Trip",         target: 5000,  current: 2840,  account: "Assets:Bank:HYSA",   due: "2026-09-15", color: "sky"     },
    { id: "g3", name: "New MacBook",        target: 3500,  current: 1900,  account: "Assets:Bank:HYSA",   due: "2026-08-01", color: "violet"  },
    { id: "g4", name: "House Down Payment", target: 80000, current: 18200, account: "Assets:Bank:HYSA",   due: "2028-06-01", color: "amber"   },
  ];

  const positions: Position[] = [
    { ticker: "VTI",   name: "Vanguard Total Stock Market",  shares: 142.5, costBasis: 215.40, price: 268.74, account: "Assets:Investments:Brokerage" },
    { ticker: "VXUS",  name: "Vanguard Total International", shares: 88.2,  costBasis: 56.10,  price: 62.18,  account: "Assets:Investments:Brokerage" },
    { ticker: "BND",   name: "Vanguard Total Bond",          shares: 64.0,  costBasis: 72.85,  price: 71.42,  account: "Assets:Investments:Brokerage" },
    { ticker: "VTSAX", name: "Vanguard Total Stock Admiral", shares: 612.4, costBasis: 102.20, price: 134.82, account: "Assets:Investments:401k"       },
    { ticker: "VTIAX", name: "Vanguard Total Intl Admiral",  shares: 148.0, costBasis: 28.50,  price: 32.74,  account: "Assets:Investments:401k"       },
    { ticker: "FXAIX", name: "Fidelity 500 Index",           shares: 92.1,  costBasis: 158.40, price: 198.20, account: "Assets:Investments:Roth"        },
    { ticker: "AAPL",  name: "Apple Inc.",                   shares: 14.0,  costBasis: 168.20, price: 224.18, account: "Assets:Investments:Brokerage" },
    { ticker: "MSFT",  name: "Microsoft Corp.",              shares: 8.0,   costBasis: 320.50, price: 462.40, account: "Assets:Investments:Brokerage" },
  ];

  // Portfolio time series
  const portfolioSeries: SeriesPoint[] = [];
  let p = 175000;
  for (let d = 89; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(now.getDate() - d);
    p *= 1 + (rand() - 0.48) * 0.012;
    portfolioSeries.push({ date: date.toISOString().slice(0, 10), value: Math.round(p) });
  }

  return { accounts, transactions, netWorthSeries, goals, positions, portfolioSeries };
}

export const BEANS_DATA = buildData();
