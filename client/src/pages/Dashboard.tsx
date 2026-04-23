import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ArrowRightOnRectangleIcon,
  BanknoteIcon,
  BookOpenIcon,
  CreditCardIcon,
  FlagIcon,
  ListBulletIcon,
} from "../components/icons";

const nav = [
  { to: "accounts", label: "Accounts", icon: <CreditCardIcon className="w-5 h-5" /> },
  { to: "transactions", label: "Transactions", icon: <ListBulletIcon className="w-5 h-5" /> },
  { to: "budget", label: "Budget", icon: <BanknoteIcon className="w-5 h-5" /> },
  { to: "goals", label: "Goals", icon: <FlagIcon className="w-5 h-5" /> },
  { to: "ledger", label: "Ledger", icon: <BookOpenIcon className="w-5 h-5" /> },
];

export default function Dashboard() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-60 shrink-0 flex flex-col bg-slate-900">
        <div className="px-6 py-5 border-b border-slate-800">
          <span className="text-white font-bold text-lg tracking-tight">beans</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
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

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
