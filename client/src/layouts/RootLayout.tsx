import { Outlet, NavLink } from "react-router-dom";
import type { NavItem } from "../types";

const NAV_ITEMS: NavItem[] = [
  { label: "Home", to: "/" },
];

export default function RootLayout() {
  return (
    <div className="app">
      <header className="header">
        <nav className="nav">
          <NavLink to="/" className="nav-brand">
            MyApp
          </NavLink>
          <ul className="nav-links">
            {NAV_ITEMS.map(({ label, to }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} MyApp</p>
      </footer>
    </div>
  );
}

