import { useState } from "react";
import { Card } from "../components/ui";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState("kevin");
  const [pass, setPass] = useState("");

  return (
    <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: "radial-gradient(800px 500px at 30% 20%, #34d39922, transparent), radial-gradient(700px 400px at 80% 80%, #38bdf822, transparent)" }}
      />
      <div className="relative w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-4 shadow-2xl shadow-emerald-500/30">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 4c0 4-4 5-4 9a4 4 0 0 0 8 0c0-4-4-5-4-9z" />
              <path d="M16 7c0 3-3 4-3 7a3 3 0 0 0 6 0c0-3-3-4-3-7z" />
            </svg>
          </div>
          <h1 className="text-white text-2xl font-semibold tracking-tight">welcome to beans</h1>
          <p className="text-neutral-500 text-sm mt-1">double-entry money for humans</p>
        </div>
        <Card className="p-6 backdrop-blur">
          <form
            onSubmit={(e) => { e.preventDefault(); onLogin(); }}
            className="space-y-4"
          >
            <div>
              <label className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">Username</label>
              <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full mt-1.5 bg-white/5 ring-1 ring-white/10 rounded-lg px-3 h-10 text-white text-sm focus:ring-emerald-500/50 outline-none transition-shadow"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">Password</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                className="w-full mt-1.5 bg-white/5 ring-1 ring-white/10 rounded-lg px-3 h-10 text-white text-sm focus:ring-emerald-500/50 outline-none transition-shadow"
              />
            </div>
            <button
              type="submit"
              className="w-full h-10 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold text-sm transition-colors shadow-lg shadow-emerald-500/20"
            >
              Sign in
            </button>
          </form>
        </Card>
        <p className="text-center text-neutral-600 text-xs mt-6">
          your books are stored locally · powered by beancount
        </p>
      </div>
    </div>
  );
}
