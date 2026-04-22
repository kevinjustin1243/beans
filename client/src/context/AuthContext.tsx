import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface AuthState {
  username: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUsername(data?.username ?? null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const r = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.detail ?? "Login failed");
    }
    const data = await r.json();
    setUsername(data.username);
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUsername(null);
  }

  return (
    <AuthContext.Provider value={{ username, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
