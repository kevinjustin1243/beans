import { useEffect, useState } from "react";
import { apiFetch } from "./api";

let cache: string[] | null = null;
let pending: Promise<string[]> | null = null;
const subscribers = new Set<(a: string[]) => void>();

function load(): Promise<string[]> {
  if (cache) return Promise.resolve(cache);
  if (pending) return pending;
  pending = apiFetch("/api/accounts")
    .then((r) => r.json())
    .then((d) => {
      cache = (d.accounts as string[]) ?? [];
      subscribers.forEach((cb) => cb(cache!));
      return cache;
    })
    .finally(() => { pending = null; });
  return pending;
}

export function useAccounts(): string[] {
  const [accounts, setAccounts] = useState<string[]>(cache ?? []);
  useEffect(() => {
    let cancelled = false;
    load().then((a) => { if (!cancelled) setAccounts(a); });
    subscribers.add(setAccounts);
    return () => { cancelled = true; subscribers.delete(setAccounts); };
  }, []);
  return accounts;
}

/** Call after operations that may have created/closed accounts. */
export function invalidateAccounts(): void {
  cache = null;
  load();  // refetch immediately and notify subscribers
}
