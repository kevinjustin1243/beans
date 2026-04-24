import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ArrowRightOnRectangleIcon,
  ArrowTrendingUpIcon,
  BanknoteIcon,
  Bars3Icon,
  BookOpenIcon,
  CreditCardIcon,
  FlagIcon,
  ListBulletIcon,
  XMarkIcon,
} from "../components/icons";

const nav = [
  { to: "accounts", label: "Accounts", icon: <CreditCardIcon className="w-5 h-5" /> },
  { to: "transactions", label: "Transactions", icon: <ListBulletIcon className="w-5 h-5" /> },
  { to: "budget", label: "Budget", icon: <BanknoteIcon className="w-5 h-5" /> },
  { to: "goals", label: "Goals", icon: <FlagIcon className="w-5 h-5" /> },
  { to: "investments", label: "Investments", icon: <ArrowTrendingUpIcon className="w-5 h-5" /> },
  { to: "ledger", label: "Ledger", icon: <BookOpenIcon className="w-5 h-5" /> },
];

export default function Dashboard() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const currentLabel = nav.find((n) => location.pathname.endsWith(n.to))?.label ?? "beans";

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Backdrop on mobile when drawer open */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-60 shrink-0 flex flex-col bg-slate-900 transform transition-transform md:transform-none ${
          menuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <span className="text-white font-bold text-lg tracking-tight">beans</span>
          <button
            onClick={() => setMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
            aria-label="Close menu"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-slate-800">
          <div className="text-slate-400 text-xs mb-2 px-1">{username}</div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
          <button
            onClick={() => setMenuOpen(true)}
            className="text-slate-300 hover:text-white p-1 -ml-1"
            aria-label="Open menu"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <span className="ml-3 text-white font-semibold tracking-tight">{currentLabel}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
