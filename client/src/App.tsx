import { useState } from "react";
import { Sidebar, TopBar } from "./components/Nav";
import { Btn } from "./components/ui";
import Login from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import AccountsPage from "./pages/Accounts";
import TransactionsPage from "./pages/Transactions";
import BudgetPage from "./pages/Budget";
import GoalsPage from "./pages/Goals";
import InvestmentsPage from "./pages/Investments";
import LedgerPage from "./pages/Ledger";

type PageId = "dashboard" | "accounts" | "transactions" | "budget" | "goals" | "investments" | "ledger";

const PAGE_META: Record<PageId, { title: string; subtitle: string }> = {
  dashboard:    { title: "Dashboard",    subtitle: "an overview of your money" },
  accounts:     { title: "Accounts",     subtitle: "all balances, hierarchical" },
  transactions: { title: "Transactions", subtitle: "every double-entry posting" },
  budget:       { title: "Budget",       subtitle: "spend versus targets" },
  goals:        { title: "Goals",        subtitle: "what you're saving toward" },
  investments:  { title: "Investments",  subtitle: "positions and performance" },
  ledger:       { title: "Ledger",       subtitle: "raw beancount source" },
};

const PAGE_COMPONENTS: Record<PageId, React.ComponentType> = {
  dashboard:    DashboardPage,
  accounts:     AccountsPage,
  transactions: TransactionsPage,
  budget:       BudgetPage,
  goals:        GoalsPage,
  investments:  InvestmentsPage,
  ledger:       LedgerPage,
};

export default function App() {
  const [authed, setAuthed]         = useState(true);
  const [page, setPage]             = useState<PageId>("dashboard");
  const [collapsed, setCollapsed]   = useState(false);
  const [transitionKey, setKey]     = useState(0);

  function navigate(p: PageId) {
    if (p === page) return;
    setPage(p);
    setKey((k) => k + 1);
  }

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const meta      = PAGE_META[page];
  const PageComp  = PAGE_COMPONENTS[page];

  return (
    <div className="flex h-screen w-screen bg-neutral-950 text-neutral-200 overflow-hidden font-geist">
      <Sidebar
        current={page}
        onNavigate={navigate}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          title={meta.title}
          subtitle={meta.subtitle}
          actions={
            <>
              <Btn variant="ghost">
                <span className="text-base leading-none">⌘</span>K
              </Btn>
              <Btn variant="ghost">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M10 21a2 2 0 0 0 4 0" />
                </svg>
              </Btn>
              <Btn variant="primary">+ Quick add</Btn>
            </>
          }
        />
        <div key={transitionKey} className="flex-1 overflow-y-auto page-enter">
          <PageComp />
        </div>
      </main>
      <button
        onClick={() => setAuthed(false)}
        className="fixed bottom-4 right-4 px-3 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-500 text-[11px] z-50 transition-colors"
        title="Show login screen"
      >
        ⤴ Login
      </button>
    </div>
  );
}
